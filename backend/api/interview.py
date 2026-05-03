"""Interview session APIs."""

from __future__ import annotations

import json
import secrets
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.auth import get_current_user, get_optional_user_from_authorization_header
from config import settings
from database import get_db
from models.interview import InterviewMessage, InterviewSession
from models.user import User
from schemas.interview import InterviewCreate, InterviewListResponse, InterviewResponse, MessageResponse
from services.asr_service import ASRServiceInstance
from services.expression_analyzer import ExpressionAnalyzerInstance
from services.interview_service import InterviewServiceInstance
from services.llm_service import LLMServiceInstance

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _serialize_message(message: InterviewMessage) -> MessageResponse:
    response = MessageResponse(
        id=message.id,
        session_id=message.session_id,
        role=message.role,
        content=message.content,
        audio_url=message.audio_url,
        audio_format=message.audio_format,
        transcript_source=message.transcript_source,
        stage=message.stage,
        created_at=message.created_at,
    )
    if message.expression_metrics:
        try:
            response.expression_metrics = json.loads(message.expression_metrics)
        except json.JSONDecodeError:
            response.expression_metrics = None
    return response


def _serialize_session(session: InterviewSession) -> InterviewResponse:
    return InterviewResponse(
        id=session.id,
        user_id=session.user_id,
        is_trial=session.is_trial,
        trial_token=session.trial_token,
        position_type=session.position_type,
        difficulty=session.difficulty,
        interview_type=session.interview_type,
        status=session.status,
        current_stage=session.current_stage,
        total_score=session.total_score,
        started_at=session.started_at,
        ended_at=session.ended_at,
        messages=[_serialize_message(message) for message in getattr(session, "messages", [])],
    )


def _build_audio_public_url(file_path: Path) -> str:
    try:
        uploads_root = Path(settings.AUDIO_UPLOAD_DIR).resolve().parent
        relative_path = file_path.resolve().relative_to(uploads_root)
        return f"/uploads/{relative_path.as_posix()}"
    except Exception:
        return str(file_path)


def _guess_audio_extension(filename: str | None, content_type: str | None) -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    if content_type:
        mapping = {
            "audio/webm": "webm",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/ogg": "ogg",
        }
        if content_type in mapping:
            return mapping[content_type]
    return "webm"


def _save_audio_bytes(audio_bytes: bytes, extension: str) -> Path:
    audio_dir = Path(settings.AUDIO_UPLOAD_DIR).resolve()
    audio_dir.mkdir(parents=True, exist_ok=True)
    file_path = audio_dir / f"{uuid.uuid4().hex}.{extension}"
    file_path.write_bytes(audio_bytes)
    return file_path


async def _parse_message_request(request: Request) -> tuple[str, bytes | None, str | None]:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        content = str(form.get("content") or "")
        audio = form.get("audio")
        if audio is None:
            return content, None, None
        audio_bytes = await audio.read()
        extension = _guess_audio_extension(getattr(audio, "filename", None), getattr(audio, "content_type", None))
        return content, audio_bytes, extension

    payload = await request.json()
    return str(payload.get("content") or ""), None, None


async def _create_session(
    db: AsyncSession,
    data: InterviewCreate,
    user_id: int | None,
    is_trial: bool,
) -> InterviewSession:
    session = InterviewSession(
        user_id=user_id,
        is_trial=is_trial,
        trial_token=secrets.token_hex(16) if is_trial else None,
        position_type=data.position_type,
        difficulty=data.difficulty,
        interview_type=data.interview_type,
        status="ongoing",
        current_stage="intro",
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)

    opening = await InterviewServiceInstance.start_interview(session)
    ai_message = InterviewMessage(session_id=session.id, role="interviewer", content=opening, stage="intro")
    db.add(ai_message)
    await db.flush()

    result = await db.execute(
        select(InterviewSession).options(selectinload(InterviewSession.messages)).where(InterviewSession.id == session.id)
    )
    return result.scalar_one()


async def get_session_with_access(
    session_id: int,
    db: AsyncSession,
    current_user: User | None = None,
    trial_token: str | None = None,
) -> InterviewSession:
    result = await db.execute(
        select(InterviewSession).options(selectinload(InterviewSession.messages)).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="面试会话不存在")

    if session.is_trial:
        if not trial_token or trial_token != session.trial_token:
            raise HTTPException(status_code=403, detail="游客试用凭证无效")
        return session

    if not current_user or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问该面试会话")
    return session


async def _resolve_user_message(
    session: InterviewSession,
    request: Request,
    db: AsyncSession,
) -> tuple[str, str, dict | None, str | None, str | None, bool, str | None]:
    content, audio_bytes, audio_extension = await _parse_message_request(request)
    transcript = content.strip()
    transcript_source = "text"
    expression_metrics = None
    audio_url = None

    if audio_bytes:
        saved_path = _save_audio_bytes(audio_bytes, audio_extension or "webm")
        audio_url = _build_audio_public_url(saved_path)
        transcript, transcript_source = await ASRServiceInstance.transcribe(
            audio_bytes,
            format=audio_extension or "webm",
            hint_text=transcript,
        )
        expression_metrics = await ExpressionAnalyzerInstance.analyze(audio_bytes, transcript=transcript or content)

    final_content = transcript.strip() or content.strip()
    if not final_content:
        if audio_bytes:
            raise HTTPException(
                status_code=422,
                detail="No transcript detected from audio. Please use Chrome or Edge for browser speech recognition, or configure the backend ASR service.",
            )
        raise HTTPException(status_code=422, detail="Message content is empty")

    accepted = True
    feedback = None
    try:
        accepted = InterviewServiceInstance.is_meaningful_answer(final_content, session.current_stage)
        if not accepted:
            feedback = "这条回答过短或过于笼统，不会计入正式作答。请补充你的职责、方案、过程和结果。"
    except Exception:
        accepted = True

    user_msg = InterviewMessage(
        session_id=session.id,
        role="candidate",
        content=final_content,
        audio_url=audio_url,
        audio_format=audio_extension,
        transcript_source=transcript_source,
        expression_metrics=json.dumps(expression_metrics, ensure_ascii=False) if expression_metrics else None,
        stage=session.current_stage,
    )
    db.add(user_msg)
    await db.flush()
    session.messages = list(session.messages or []) + [user_msg]
    return final_content, session.current_stage, expression_metrics, audio_url, transcript_source, accepted, feedback


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("", response_model=InterviewResponse, summary="Create interview session")
async def create_interview(
    data: InterviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _create_session(db, data, user_id=current_user.id, is_trial=False)
    return _serialize_session(session)


@router.post("/trial", response_model=InterviewResponse, summary="Create trial interview")
async def create_trial_interview(
    data: InterviewCreate,
    db: AsyncSession = Depends(get_db),
):
    session = await _create_session(db, data, user_id=None, is_trial=True)
    return _serialize_session(session)


@router.post("/{session_id}/message", response_model=MessageResponse, summary="Send message")
async def send_message(
    session_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = await get_optional_user_from_authorization_header(request.headers.get("authorization"), db)
    session = await get_session_with_access(
        session_id=session_id,
        db=db,
        current_user=current_user,
        trial_token=request.headers.get("x-trial-token"),
    )

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed")

    final_content, _, _, _, _, accepted, feedback = await _resolve_user_message(session, request, db)
    ai_reply = await InterviewServiceInstance.process_answer(session, final_content)
    ai_msg = InterviewMessage(session_id=session.id, role="interviewer", content=ai_reply, stage=session.current_stage)
    db.add(ai_msg)
    await db.flush()
    await db.refresh(ai_msg)

    response = _serialize_message(ai_msg)
    response.accepted = accepted
    response.feedback = feedback
    return response


@router.post("/{session_id}/message/stream", summary="Send message with streaming reply")
async def send_message_stream(
    session_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = await get_optional_user_from_authorization_header(request.headers.get("authorization"), db)
    session = await get_session_with_access(
        session_id=session_id,
        db=db,
        current_user=current_user,
        trial_token=request.headers.get("x-trial-token"),
    )

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed")

    final_content, _, _, _, _, accepted, feedback = await _resolve_user_message(session, request, db)
    plan = await InterviewServiceInstance.prepare_reply(session, final_content)

    async def event_stream():
        reply_parts: list[str] = []
        try:
            async for chunk in LLMServiceInstance.chat_stream(
                messages=plan.chat_history,
                system_prompt=plan.system_prompt,
            ):
                reply_parts.append(chunk)
                yield _sse("delta", {"content": chunk})

            full_reply = "".join(reply_parts).strip()
            ai_msg = InterviewMessage(session_id=session.id, role="interviewer", content=full_reply, stage=session.current_stage)
            db.add(ai_msg)
            if plan.is_valid_answer:
                session.current_question_index += 1
            await db.flush()
            await db.refresh(ai_msg)

            yield _sse(
                "done",
                {
                    "id": ai_msg.id,
                    "session_id": ai_msg.session_id,
                    "role": ai_msg.role,
                    "content": full_reply,
                    "stage": ai_msg.stage,
                    "created_at": ai_msg.created_at.isoformat(),
                    "accepted": accepted,
                    "feedback": feedback,
                },
            )
        except Exception as exc:
            yield _sse("error", {"detail": f"Streaming reply failed: {exc}"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{session_id}/end", response_model=InterviewResponse, summary="End interview")
async def end_interview(
    session_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = await get_optional_user_from_authorization_header(request.headers.get("authorization"), db)
    session = await get_session_with_access(
        session_id=session_id,
        db=db,
        current_user=current_user,
        trial_token=request.headers.get("x-trial-token"),
    )

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed")

    try:
        from services.scoring_service import ScoringServiceInstance

        report = await ScoringServiceInstance.score_interview(
            session_messages=session.messages,
            position_type=session.position_type,
            session_id=session.id,
        )
        total_score = report.total_score
    except Exception:
        total_score = 0.0

    session.status = "completed"
    session.ended_at = datetime.utcnow()
    session.total_score = total_score
    await db.flush()

    result = await db.execute(
        select(InterviewSession).options(selectinload(InterviewSession.messages)).where(InterviewSession.id == session.id)
    )
    completed_session = result.scalar_one()
    return _serialize_session(completed_session)


@router.get("/{session_id}", response_model=InterviewResponse, summary="Get interview detail")
async def get_interview_detail(
    session_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = await get_optional_user_from_authorization_header(request.headers.get("authorization"), db)
    session = await get_session_with_access(
        session_id=session_id,
        db=db,
        current_user=current_user,
        trial_token=request.headers.get("x-trial-token"),
    )
    return _serialize_session(session)


@router.get("", response_model=list[InterviewListResponse], summary="List interviews")
async def list_interviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_id == current_user.id, InterviewSession.is_trial.is_(False))
        .order_by(InterviewSession.started_at.desc())
        .limit(20)
    )
    sessions = result.scalars().all()
    return [InterviewListResponse.model_validate(item) for item in sessions]
