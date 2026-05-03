"""Interview report schemas."""

from typing import List

from pydantic import BaseModel, Field


class DimensionScore(BaseModel):
    dimension: str = Field(..., description="Dimension name")
    score: float = Field(..., ge=0, le=100, description="Dimension score")
    weight: float = Field(default=0.0, description="Dimension weight")
    comment: str = Field(default="", description="Dimension review")


class QuestionReview(BaseModel):
    question: str = Field(..., description="Question content")
    answer_summary: str = Field(..., description="Answer summary")
    score: float = Field(..., ge=0, le=100, description="Question score")
    comment: str = Field(default="", description="Question review")
    suggestions: str = Field(default="", description="Improvement suggestions")
    technical_accuracy: float = Field(default=0.0, ge=0, le=100, description="Technical accuracy")
    knowledge_depth: float = Field(default=0.0, ge=0, le=100, description="Knowledge depth")
    logic_expression: float = Field(default=0.0, ge=0, le=100, description="Logic expression")
    position_match: float = Field(default=0.0, ge=0, le=100, description="Position match")
    evidence: List[str] = Field(default_factory=list, description="Supporting evidence")
    issues: List[str] = Field(default_factory=list, description="Observed issues")


class LearningResource(BaseModel):
    title: str = Field(..., description="Resource title")
    type: str = Field(default="article", description="Resource type")
    description: str = Field(default="", description="Resource description")
    url: str = Field(default="", description="Resource URL")


class TrainingDay(BaseModel):
    day: int = Field(..., description="Training day")
    title: str = Field(..., description="Training topic")
    tasks: List[str] = Field(default_factory=list, description="Training tasks")


class ExpressionSummary(BaseModel):
    speech_rate: float = Field(default=0.0, description="Average speech rate")
    pause_ratio: float = Field(default=0.0, description="Average pause ratio")
    fluency_score: float = Field(default=0.0, description="Fluency score")
    confidence: float = Field(default=0.0, description="Confidence score")
    sample_count: int = Field(default=0, description="Sample count")
    clarity_score: float = Field(default=0.0, description="Speech clarity score")
    emotion_stability: float = Field(default=0.0, description="Emotional stability score")
    confidence_label: str = Field(default="", description="Confidence label")
    emotion_label: str = Field(default="", description="Emotion label")
    analysis_source: str = Field(default="", description="Analysis source")
    comment: str = Field(default="", description="Expression analysis summary")


class InterviewReport(BaseModel):
    session_id: int = Field(..., description="Interview session ID")
    position_type: str = Field(..., description="Position type")
    total_score: float = Field(..., ge=0, le=100, description="Total score")
    level: str = Field(default="", description="Evaluation level")
    dimensions: List[DimensionScore] = Field(default_factory=list, description="Dimension scores")
    question_reviews: List[QuestionReview] = Field(default_factory=list, description="Per-question reviews")
    strengths: List[str] = Field(default_factory=list, description="Strength summary")
    weaknesses: List[str] = Field(default_factory=list, description="Weakness summary")
    overall_comment: str = Field(default="", description="Overall comment")
    suggestions: List[str] = Field(default_factory=list, description="Learning suggestions")
    resources: List[LearningResource] = Field(default_factory=list, description="Recommended resources")
    training_plan: List[TrainingDay] = Field(default_factory=list, description="Training plan")
    expression_summary: ExpressionSummary | None = Field(default=None, description="Expression analysis summary")
