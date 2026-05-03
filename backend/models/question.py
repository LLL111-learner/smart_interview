"""
题库模型
"""

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="题目 ID")
    position_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="岗位类型",
    )
    category: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="分类：technical / project / scenario / behavior",
    )
    difficulty: Mapped[str] = mapped_column(
        String(20),
        default="normal",
        comment="难度：easy / normal / hard",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="题目内容",
    )
    reference_answer: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="参考答案",
    )
    tags: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="标签列表，JSON 数组",
    )
    follow_up_questions: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="追问列表，JSON 数组",
    )
