"""Growth analysis API."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.auth import get_current_user
from database import get_db
from models.interview import InterviewSession
from models.user import User
from services.recommendation_service import RecommendationServiceInstance
from services.scoring_service import CN_TO_DIMENSION, DIMENSION_CN, ScoringServiceInstance

router = APIRouter(prefix="/growth", tags=["growth"])
logger = logging.getLogger(__name__)


class GrowthOverview(BaseModel):
    total_interviews: int = Field(0, description="累计面试次数")
    avg_score: float = Field(0.0, description="平均分")
    highest_score: float = Field(0.0, description="最高分")
    streak_days: int = Field(0, description="连续打卡天数")


class TrendPoint(BaseModel):
    date: str
    score: float
    position_type: str


class WeakPoint(BaseModel):
    topic: str
    frequency: int
    avg_score: float


class LearningTask(BaseModel):
    title: str
    due_date: str
    completed: bool = False


class RecentInterview(BaseModel):
    session_id: int
    position: str
    position_type: str
    date: str
    score: float


class LearningRecommendation(BaseModel):
    weak_points: list[WeakPoint] = Field(default_factory=list)
    weak_areas: list[str] = Field(default_factory=list)
    learning_tasks: list[LearningTask] = Field(default_factory=list)
    training_plan: list[dict] = Field(default_factory=list)
    recent_interviews: list[RecentInterview] = Field(default_factory=list)
    learning_plan: dict = Field(default_factory=dict)
    resources: list[dict] = Field(default_factory=list)


POSITION_LABELS = {
    "java_backend": "Java 后端",
    "web_frontend": "Web 前端",
    "embedded": "嵌入式",
    "python_algorithm": "Python 算法",
    "software_testing": "软件测试",
    "devops": "DevOps",
}


def _report_to_score_map(report) -> dict[str, float]:
    score_map: dict[str, float] = {}
    for item in getattr(report, "dimensions", []):
        key = CN_TO_DIMENSION.get(item.dimension)
        if key:
            score_map[key] = float(item.score)
    return score_map


@router.get("/overview", response_model=GrowthOverview, summary="获取成长概览")
async def get_growth_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_id == current_user.id, InterviewSession.status == "completed")
        .order_by(InterviewSession.started_at.asc())
    )
    sessions = result.scalars().all()

    if not sessions:
        return GrowthOverview()

    scores = [float(session.total_score) for session in sessions if session.total_score is not None]
    dates = sorted({session.started_at.date() for session in sessions if session.started_at}, reverse=True)

    streak = 0
    if dates:
        streak = 1
        for index in range(1, len(dates)):
            if dates[index - 1] - dates[index] == timedelta(days=1):
                streak += 1
            else:
                break

    return GrowthOverview(
        total_interviews=len(sessions),
        avg_score=round(sum(scores) / len(scores), 1) if scores else 0.0,
        highest_score=max(scores) if scores else 0.0,
        streak_days=streak,
    )


@router.get("/trend", response_model=list[TrendPoint], summary="获取成长趋势")
async def get_growth_trend(
    position_type: Optional[str] = Query(None, description="岗位类型过滤"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(InterviewSession)
        .where(
            InterviewSession.user_id == current_user.id,
            InterviewSession.status == "completed",
            InterviewSession.total_score.is_not(None),
        )
        .order_by(InterviewSession.started_at.asc())
    )
    if position_type:
        query = query.where(InterviewSession.position_type == position_type)

    result = await db.execute(query)
    sessions = result.scalars().all()
    return [
        TrendPoint(
            date=session.started_at.strftime("%Y-%m-%d"),
            score=float(session.total_score or 0),
            position_type=session.position_type,
        )
        for session in sessions
        if session.started_at
    ]


@router.get("/recommendations", response_model=LearningRecommendation, summary="获取成长建议")
async def get_recommendations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewSession)
        .options(selectinload(InterviewSession.messages))
        .where(InterviewSession.user_id == current_user.id, InterviewSession.status == "completed")
        .order_by(InterviewSession.started_at.desc())
        .limit(5)
    )
    sessions = result.scalars().all()

    if not sessions:
        return LearningRecommendation()

    latest_session = sessions[0]
    try:
        latest_report = await ScoringServiceInstance.score_interview(
            session_messages=latest_session.messages,
            position_type=latest_session.position_type,
            session_id=latest_session.id,
        )
    except Exception:
        logger.exception("Failed to score latest session for growth recommendations", extra={"session_id": latest_session.id})
        latest_report = None

    topic_scores: dict[str, list[float]] = defaultdict(list)
    latest_score_map = _report_to_score_map(latest_report) if latest_report else {}

    for key, score in latest_score_map.items():
        if score < 75:
            topic_scores[DIMENSION_CN.get(key, key)].append(score)

    weak_points = [
        WeakPoint(topic=topic, frequency=len(scores), avg_score=round(sum(scores) / len(scores), 1))
        for topic, scores in topic_scores.items()
    ]
    weak_points.sort(key=lambda item: (-item.frequency, item.avg_score))

    weak_keys = [key for key, value in latest_score_map.items() if value < 75]
    learning_plan = await RecommendationServiceInstance.get_learning_plan(latest_score_map, latest_session.position_type)
    resources = await RecommendationServiceInstance.get_resources(weak_keys, latest_session.position_type)
    training_plan = await RecommendationServiceInstance.generate_training_plan(
        latest_score_map,
        latest_session.position_type,
        days=7,
    )

    learning_tasks = [
        LearningTask(
            title=f"Day {item.get('day', 0)}: {item.get('focus', '专项训练')}",
            due_date=item.get("duration", f"Day {item.get('day', 0)}"),
            completed=False,
        )
        for item in training_plan
    ]

    recent_interviews = []
    for session in sessions:
        score = float(session.total_score or 0)
        if score <= 0 and session.id == latest_session.id and latest_report:
            score = float(latest_report.total_score or 0)
        recent_interviews.append(
            RecentInterview(
                session_id=session.id,
                position=POSITION_LABELS.get(session.position_type, session.position_type),
                position_type=session.position_type,
                date=session.started_at.strftime("%Y-%m-%d %H:%M") if session.started_at else "",
                score=score,
            )
        )

    return LearningRecommendation(
        weak_points=weak_points[:6],
        weak_areas=[DIMENSION_CN.get(key, key) for key in weak_keys],
        learning_tasks=learning_tasks,
        training_plan=training_plan,
        recent_interviews=recent_interviews,
        learning_plan=learning_plan,
        resources=resources,
    )
