"""Admin APIs."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_admin
from database import get_db
from models.interview import InterviewSession
from models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminOverview(BaseModel):
    total_users: int
    today_new_users: int
    total_interviews: int
    completed_interviews: int


class DirectionDistributionItem(BaseModel):
    target_position: str
    user_count: int


class AdminUserItem(BaseModel):
    id: int
    username: str
    real_name: str | None
    target_position: str | None
    is_admin: bool
    created_at: datetime
    interview_count: int
    completed_interview_count: int
    avg_score: float | None


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]
    total: int


@router.get("/overview", response_model=AdminOverview, summary="管理员概览")
async def get_admin_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    today = datetime.now().date()

    total_users = await db.scalar(select(func.count()).select_from(User))
    today_new_users = await db.scalar(
        select(func.count()).select_from(User).where(func.date(User.created_at) == str(today))
    )
    total_interviews = await db.scalar(select(func.count()).select_from(InterviewSession))
    completed_interviews = await db.scalar(
        select(func.count()).select_from(InterviewSession).where(InterviewSession.status == "completed")
    )

    return AdminOverview(
        total_users=int(total_users or 0),
        today_new_users=int(today_new_users or 0),
        total_interviews=int(total_interviews or 0),
        completed_interviews=int(completed_interviews or 0),
    )


@router.get("/directions", response_model=list[DirectionDistributionItem], summary="求职方向分布")
async def get_direction_distribution(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(User.target_position, func.count(User.id))
        .group_by(User.target_position)
        .order_by(func.count(User.id).desc())
    )
    return [
        DirectionDistributionItem(target_position=target_position or "未填写", user_count=int(user_count or 0))
        for target_position, user_count in result.all()
    ]


@router.get("/users", response_model=AdminUsersResponse, summary="用户列表")
async def get_admin_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(
            User.id,
            User.username,
            User.real_name,
            User.target_position,
            User.is_admin,
            User.created_at,
            func.count(InterviewSession.id).label("interview_count"),
            func.coalesce(
                func.sum(case((InterviewSession.status == "completed", 1), else_=0)),
                0,
            ).label("completed_interview_count"),
            func.avg(InterviewSession.total_score).label("avg_score"),
        )
        .select_from(User)
        .join(InterviewSession, InterviewSession.user_id == User.id, isouter=True)
        .group_by(
            User.id,
            User.username,
            User.real_name,
            User.target_position,
            User.is_admin,
            User.created_at,
        )
        .order_by(User.created_at.desc())
    )

    items = [
        AdminUserItem(
            id=row.id,
            username=row.username,
            real_name=row.real_name,
            target_position=row.target_position,
            is_admin=bool(row.is_admin),
            created_at=row.created_at,
            interview_count=int(row.interview_count or 0),
            completed_interview_count=int(row.completed_interview_count or 0),
            avg_score=round(float(row.avg_score), 1) if row.avg_score is not None else None,
        )
        for row in result.all()
    ]

    return AdminUsersResponse(items=items, total=len(items))
