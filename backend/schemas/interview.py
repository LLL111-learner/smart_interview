from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class InterviewCreate(BaseModel):
    position_type: str = Field(..., description="岗位类型")
    difficulty: str = Field(default="normal", description="难度")
    interview_type: str = Field(default="comprehensive", description="面试类型")


class InterviewMessageCreate(BaseModel):
    content: str = Field(default="", description="文本内容")
    audio_url: str | None = Field(None, description="音频 URL")


class MessageResponse(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    audio_url: str | None = None
    audio_format: str | None = None
    transcript_source: str | None = None
    expression_metrics: dict[str, Any] | None = None
    stage: str
    created_at: datetime
    accepted: bool = True
    feedback: str | None = None

    model_config = {"from_attributes": True}


class InterviewResponse(BaseModel):
    id: int
    user_id: int | None = None
    is_trial: bool = False
    trial_token: str | None = None
    position_type: str
    difficulty: str
    interview_type: str
    status: str
    current_stage: str
    total_score: float | None = None
    started_at: datetime
    ended_at: datetime | None = None
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}


class InterviewListResponse(BaseModel):
    id: int
    position_type: str
    difficulty: str
    interview_type: str
    status: str
    is_trial: bool = False
    total_score: float | None = None
    started_at: datetime
    ended_at: datetime | None = None

    model_config = {"from_attributes": True}
