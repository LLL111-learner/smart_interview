"""
题库管理路由
包含按条件查询题目和管理端添加题目
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from database import get_db
from models.question import Question

router = APIRouter(prefix="/questions", tags=["题库"])


# ---------- 请求/响应模型 ----------

class QuestionCreate(BaseModel):
    """添加题目请求"""
    position_type: str = Field(..., description="岗位类型")
    category: str = Field(..., description="分类: technical / project / scenario / behavior")
    difficulty: str = Field(default="normal", description="难度")
    content: str = Field(..., description="题目内容")
    reference_answer: Optional[str] = Field(None, description="参考答案")
    tags: Optional[list] = Field(None, description="标签列表")
    follow_up_questions: Optional[list] = Field(None, description="追问题目列表")


class QuestionResponse(BaseModel):
    """题目响应"""
    id: int
    position_type: str
    category: str
    difficulty: str
    content: str
    reference_answer: Optional[str] = None
    tags: Optional[list] = None
    follow_up_questions: Optional[list] = None

    model_config = {"from_attributes": True}


# ---------- 路由 ----------

@router.get("", response_model=List[QuestionResponse], summary="查询题目列表")
async def list_questions(
    position_type: Optional[str] = Query(None, description="岗位类型过滤"),
    category: Optional[str] = Query(None, description="分类过滤"),
    difficulty: Optional[str] = Query(None, description="难度过滤"),
    db: AsyncSession = Depends(get_db),
):
    """
    按条件查询题目
    - 支持按岗位类型、分类、难度过滤
    """
    query = select(Question)

    if position_type:
        query = query.where(Question.position_type == position_type)
    if category:
        query = query.where(Question.category == category)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)

    result = await db.execute(query)
    questions = result.scalars().all()
    return [QuestionResponse.model_validate(q) for q in questions]


@router.post("", response_model=QuestionResponse, summary="添加题目（管理端）")
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    管理端添加题目到题库
    """
    question = Question(
        position_type=data.position_type,
        category=data.category,
        difficulty=data.difficulty,
        content=data.content,
        reference_answer=data.reference_answer,
        tags=data.tags,
        follow_up_questions=data.follow_up_questions,
    )
    db.add(question)
    await db.flush()
    await db.refresh(question)
    return QuestionResponse.model_validate(question)
