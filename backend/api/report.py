"""Interview report API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_optional_user_from_authorization_header
from api.interview import get_session_with_access
from database import get_db
from schemas.report import InterviewReport
from services.recommendation_service import RecommendationServiceInstance
from services.scoring_service import CN_TO_DIMENSION, DIMENSION_CN, ScoringServiceInstance

router = APIRouter(prefix="/interviews", tags=["report"])


def _extract_score_map(report: InterviewReport) -> dict[str, float]:
    score_map: dict[str, float] = {}
    for item in report.dimensions:
        key = CN_TO_DIMENSION.get(item.dimension)
        if key:
            score_map[key] = item.score
    return score_map


@router.get("/{session_id}/report", response_model=InterviewReport, summary="获取面试报告")
async def get_interview_report(
    session_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = await get_optional_user_from_authorization_header(
        request.headers.get("authorization"),
        db,
    )
    session = await get_session_with_access(
        session_id=session_id,
        db=db,
        current_user=current_user,
        trial_token=request.headers.get("x-trial-token"),
    )

    if session.status != "completed":
        raise HTTPException(status_code=400, detail="面试尚未结束，暂时不能生成正式报告")

    report = await ScoringServiceInstance.score_interview(
        session_messages=session.messages,
        position_type=session.position_type,
        session_id=session.id,
    )

    score_map = _extract_score_map(report)
    weak_keys = [key for key, value in score_map.items() if value < 75]

    learning_plan = await RecommendationServiceInstance.get_learning_plan(score_map, session.position_type)
    resources = await RecommendationServiceInstance.get_resources(weak_keys, session.position_type)
    training_plan = await RecommendationServiceInstance.generate_training_plan(score_map, session.position_type)

    if learning_plan.get("summary_lines"):
        report.suggestions = learning_plan["summary_lines"]
    if resources:
        report.resources = resources
    if training_plan:
        report.training_plan = [
            {
                "day": item.get("day", 0),
                "title": f"Day {item.get('day', 0)}: {item.get('focus', '重点练习')}",
                "tasks": item.get("tasks", []),
            }
            for item in training_plan
        ]

    if not report.resources and score_map:
        fallback_scores = {key: 70.0 for key in DIMENSION_CN}
        report.resources = ScoringServiceInstance._generate_resources(fallback_scores, session.position_type)
    if not report.training_plan and score_map:
        fallback_scores = {key: 70.0 for key in DIMENSION_CN}
        report.training_plan = ScoringServiceInstance._generate_training_plan(fallback_scores, session.position_type)

    return report
