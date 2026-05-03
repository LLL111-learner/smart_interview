"""Speech-to-text service."""

from __future__ import annotations

import asyncio
import io
import logging
import os
from pathlib import Path
from typing import Any

import soundfile as sf
from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)


class ASRService:
    def __init__(self) -> None:
        self.client: AsyncOpenAI | None = None
        self.local_pipeline: Any | None = None
        self.faster_whisper_model: Any | None = None
        self.service_name = ""
        self._dll_directories: list[Any] = []
        self._prepare_cuda_runtime()

        base_url = settings.ASR_BASE_URL or settings.LLM_BASE_URL
        api_key = settings.ASR_API_KEY or settings.LLM_API_KEY or "asr"
        model = settings.ASR_MODEL
        if base_url and model:
            self.client = AsyncOpenAI(
                base_url=base_url,
                api_key=api_key,
                timeout=120.0,
            )
            self.service_name = base_url

    async def transcribe(
        self,
        audio_file: bytes,
        *,
        format: str = "wav",
        language: str = "zh",
        hint_text: str = "",
    ) -> tuple[str, str]:
        if not audio_file:
            return hint_text.strip(), "empty"

        text = await self._transcribe_with_faster_whisper(audio_file, language=language, hint_text=hint_text)
        if text:
            return text, "faster_whisper"

        text = await self._transcribe_with_local_model(audio_file, language=language)
        if text:
            return text, "local_asr"

        text = await self._transcribe_with_service(audio_file, format=format, language=language)
        if text:
            return text, "server_asr"

        fallback = hint_text.strip()
        if fallback:
            logger.warning("ASR unavailable, falling back to provided transcript hint")
            return fallback, "browser_fallback"
        return "", "unavailable"

    async def _transcribe_with_service(self, audio_file: bytes, *, format: str, language: str) -> str:
        if not self.client or not settings.ASR_MODEL:
            return ""
        try:
            file_obj = io.BytesIO(audio_file)
            file_obj.name = f"recording.{format or 'wav'}"
            response = await self.client.audio.transcriptions.create(
                model=settings.ASR_MODEL,
                file=file_obj,
                language=language,
            )
            return (getattr(response, "text", "") or "").strip()
        except Exception as exc:
            logger.warning("ASR service transcription failed: %s", exc)
            return ""

    async def _transcribe_with_faster_whisper(self, audio_file: bytes, *, language: str, hint_text: str = "") -> str:
        model = self._get_faster_whisper_model()
        if model is None:
            return ""
        try:
            return await asyncio.to_thread(self._run_faster_whisper, audio_file, language, hint_text)
        except Exception as exc:
            logger.warning("faster-whisper transcription failed: %s", exc)
            return ""

    def _run_faster_whisper(self, audio_file: bytes, language: str, hint_text: str = "") -> str:
        model = self._get_faster_whisper_model()
        if model is None:
            return ""

        audio_array, sample_rate = sf.read(io.BytesIO(audio_file), dtype="float32")
        if getattr(audio_array, "ndim", 1) > 1:
            audio_array = audio_array.mean(axis=1)

        base_options = {
            "language": language or "zh",
            "beam_size": 5,
            "best_of": 3,
            "temperature": 0.0,
            "condition_on_previous_text": False,
        }
        prompt = self._normalize_hint_text(hint_text)
        if prompt:
            base_options["initial_prompt"] = prompt

        text = self._collect_faster_whisper_text(model, audio_array, vad_filter=True, **base_options)
        if text:
            return text

        logger.info("faster-whisper returned no text with VAD enabled, retrying without VAD")
        return self._collect_faster_whisper_text(model, audio_array, vad_filter=False, **base_options)

    def _collect_faster_whisper_text(self, model: Any, audio_array: Any, **transcribe_options: Any) -> str:
        segments, _ = model.transcribe(audio_array, **transcribe_options)
        return "".join((segment.text or "").strip() for segment in segments).strip()

    async def _transcribe_with_local_model(self, audio_file: bytes, *, language: str) -> str:
        if not settings.ASR_LOCAL_MODEL:
            return ""
        try:
            return await asyncio.to_thread(self._run_local_pipeline, audio_file, language)
        except Exception as exc:
            logger.warning("Local transformers ASR transcription failed: %s", exc)
            return ""

    def _run_local_pipeline(self, audio_file: bytes, language: str) -> str:
        pipeline = self._get_local_pipeline()
        if pipeline is None:
            return ""

        audio_array, sample_rate = sf.read(io.BytesIO(audio_file), dtype="float32")
        if getattr(audio_array, "ndim", 1) > 1:
            audio_array = audio_array.mean(axis=1)

        generate_kwargs: dict[str, Any] = {}
        if language:
            generate_kwargs["language"] = language
        result = pipeline(
            {
                "array": audio_array,
                "sampling_rate": sample_rate,
            },
            generate_kwargs=generate_kwargs or None,
        )
        if isinstance(result, dict):
            return str(result.get("text", "")).strip()
        return str(result or "").strip()

    def _get_faster_whisper_model(self):
        if self.faster_whisper_model is not None:
            return self.faster_whisper_model

        model_name = self._resolve_local_model_path()
        if not model_name:
            return None

        try:
            from faster_whisper import WhisperModel

            device = self._resolve_faster_whisper_device()
            compute_type = self._resolve_compute_type(device)
            self.faster_whisper_model = WhisperModel(
                model_name,
                device=device,
                compute_type=compute_type,
                local_files_only=True,
            )
            logger.info("Initialized faster-whisper model: %s, device=%s, compute_type=%s", model_name, device, compute_type)
        except Exception as exc:
            logger.warning("Failed to initialize faster-whisper model %s: %s", model_name, exc)
            self.faster_whisper_model = None
        return self.faster_whisper_model

    def _get_local_pipeline(self):
        if self.local_pipeline is not None:
            return self.local_pipeline

        model_name = settings.ASR_LOCAL_MODEL.strip()
        if not model_name:
            return None

        try:
            from transformers import pipeline

            device = settings.ASR_LOCAL_DEVICE.strip() or "cpu"
            device_arg: int | str = 0 if device == "cuda" else -1
            self.local_pipeline = pipeline(
                task="automatic-speech-recognition",
                model=model_name,
                device=device_arg,
            )
            logger.info("Initialized transformers ASR model: %s", model_name)
        except Exception as exc:
            logger.warning("Failed to initialize transformers ASR model %s: %s", model_name, exc)
            self.local_pipeline = None
        return self.local_pipeline

    def _prepare_cuda_runtime(self) -> None:
        if os.name != "nt":
            return

        candidates: list[Path] = []
        cuda_path = os.environ.get("CUDA_PATH", "").strip()
        if cuda_path:
            candidates.append(Path(cuda_path) / "bin")

        default_root = Path(r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA")
        if default_root.exists():
            version_dirs = sorted(
                (item for item in default_root.iterdir() if item.is_dir()),
                reverse=True,
            )
            candidates.extend(path / "bin" for path in version_dirs)

        seen: set[str] = set()
        path_entries = os.environ.get("PATH", "").split(os.pathsep)
        for candidate in candidates:
            if not candidate.exists():
                continue
            candidate_str = str(candidate)
            normalized = candidate_str.lower()
            if normalized in seen:
                continue
            seen.add(normalized)

            if hasattr(os, "add_dll_directory"):
                try:
                    self._dll_directories.append(os.add_dll_directory(candidate_str))
                except OSError:
                    logger.debug("Unable to add CUDA DLL directory: %s", candidate_str)

            if candidate_str not in path_entries:
                path_entries.insert(0, candidate_str)

        os.environ["PATH"] = os.pathsep.join(path_entries)

    def _resolve_local_model_path(self) -> str:
        model_name = settings.ASR_LOCAL_MODEL.strip()
        if not model_name:
            return ""

        base_path = Path(model_name)
        if (base_path / "model.bin").exists():
            return str(base_path)

        for candidate in ("whisper-small", "whisper-base"):
            candidate_path = base_path / candidate
            if candidate_path.exists():
                return str(candidate_path)
        return str(base_path)

    def _resolve_faster_whisper_device(self) -> str:
        preferred = (settings.ASR_LOCAL_DEVICE or "").strip().lower()
        if preferred in {"cuda", "cpu"}:
            return preferred

        try:
            import ctranslate2

            return "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
        except Exception:
            return "cpu"

    def _resolve_compute_type(self, device: str) -> str:
        configured = (settings.ASR_LOCAL_COMPUTE_TYPE or "").strip().lower()
        if configured and configured != "default":
            return configured
        return "float16" if device == "cuda" else "int8"

    def _normalize_hint_text(self, hint_text: str) -> str:
        text = " ".join((hint_text or "").strip().split())
        if not text:
            return ""
        return text[:120]


ASRServiceInstance = ASRService()
