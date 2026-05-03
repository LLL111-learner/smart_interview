"""Database bootstrap helpers."""

from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base ORM model."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def _ensure_sqlite_columns(conn) -> None:
    result = await conn.execute(text("PRAGMA table_info(interview_messages)"))
    interview_message_columns = {row[1] for row in result.fetchall()}
    message_required_columns = {
        "audio_format": "ALTER TABLE interview_messages ADD COLUMN audio_format VARCHAR(30)",
        "transcript_source": "ALTER TABLE interview_messages ADD COLUMN transcript_source VARCHAR(30)",
        "expression_metrics": "ALTER TABLE interview_messages ADD COLUMN expression_metrics TEXT",
    }
    for column_name, ddl in message_required_columns.items():
        if column_name not in interview_message_columns:
            await conn.execute(text(ddl))

    result = await conn.execute(text("PRAGMA table_info(users)"))
    user_columns = {row[1] for row in result.fetchall()}
    user_required_columns = {
        "is_admin": "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0",
    }
    for column_name, ddl in user_required_columns.items():
        if column_name not in user_columns:
            await conn.execute(text(ddl))

    result = await conn.execute(text("PRAGMA table_info(interview_sessions)"))
    interview_session_columns = {row[1] for row in result.fetchall()}
    session_required_columns = {
        "is_trial": "ALTER TABLE interview_sessions ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT 0",
        "trial_token": "ALTER TABLE interview_sessions ADD COLUMN trial_token VARCHAR(64)",
    }
    for column_name, ddl in session_required_columns.items():
        if column_name not in interview_session_columns:
            await conn.execute(text(ddl))


async def init_db():
    async with engine.begin() as conn:
        from models import InterviewMessage, InterviewSession, Question, User  # noqa: F401

        await conn.run_sync(Base.metadata.create_all)
        if settings.DATABASE_URL.startswith("sqlite"):
            await _ensure_sqlite_columns(conn)
