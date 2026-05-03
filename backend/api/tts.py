"""Text-to-speech API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services.tts_service import TTSServiceInstance

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to synthesize")
    style: str = Field(default="neutral", description="Speech style")


@router.post("", summary="Synthesize speech")
async def synthesize_speech(payload: TTSRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text cannot be empty")

    if not TTSServiceInstance.is_configured():
        raise HTTPException(status_code=503, detail="TTS service is not configured")

    try:
        audio_bytes, audio_format = await TTSServiceInstance.synthesize(text=text, style=payload.style)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {exc}") from exc

    media_type = "audio/mpeg" if audio_format == "mp3" else f"audio/{audio_format}"
    return Response(content=audio_bytes, media_type=media_type)
