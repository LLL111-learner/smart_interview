"""Text-to-speech service."""

from __future__ import annotations

import logging
from typing import Final

from config import settings
from edge_tts import Communicate

logger = logging.getLogger(__name__)

STYLE_HINTS = {
    "warm": {"rate": "-2%", "volume": "+0%", "pitch": "+0Hz"},
    "neutral": {"rate": "+0%", "volume": "+0%", "pitch": "+0Hz"},
    "pressing": {"rate": "+8%", "volume": "+0%", "pitch": "-8Hz"},
    "encouraging": {"rate": "-8%", "volume": "+0%", "pitch": "+8Hz"},
}


class TTSService:
    def is_configured(self) -> bool:
        return bool(settings.TTS_VOICE)

    async def synthesize(self, text: str, style: str = "neutral") -> tuple[bytes, str]:
        if not self.is_configured():
            raise RuntimeError("TTS service is not configured")

        payload_style = STYLE_HINTS.get(style, STYLE_HINTS["neutral"])
        if settings.TTS_FORMAT.lower() != "mp3":
            raise RuntimeError("Edge TTS output currently supports mp3 only. Set TTS_FORMAT=mp3.")

        communicate = Communicate(
            text=text,
            voice=settings.TTS_VOICE,
            rate=payload_style["rate"],
            volume=payload_style["volume"],
            pitch=payload_style["pitch"],
        )
        audio_chunks: list[bytes] = []
        try:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.append(chunk["data"])
        except Exception as exc:
            logger.exception("Edge TTS synthesis failed")
            raise RuntimeError(f"Edge TTS synthesis failed: {exc}") from exc

        audio_bytes = b"".join(audio_chunks)
        if not audio_bytes:
            raise RuntimeError("Edge TTS returned empty audio")

        return audio_bytes, settings.TTS_FORMAT


TTSServiceInstance = TTSService()
