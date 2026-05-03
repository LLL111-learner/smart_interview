"""Audio expression analysis."""

from __future__ import annotations

import io
import logging
from typing import Any

from services.llm_service import LLMServiceInstance

logger = logging.getLogger(__name__)

EXPRESSION_SYSTEM_PROMPT = """
你是面试表达分析专家。请结合语音声学指标和转写文本，评估候选人的表达表现。
重点关注：语速、清晰度、自信度、情绪稳定性、是否存在明显犹豫或重复。
只输出 JSON。

输出 JSON 结构：
{
  "clarity_score": 0,
  "confidence_score": 0,
  "emotion_stability": 0,
  "confidence_label": "",
  "emotion_label": "",
  "comment": ""
}
"""


class ExpressionAnalyzer:
    async def analyze(self, audio_file: bytes, transcript: str = "") -> dict[str, Any]:
        if not audio_file:
            return self._default_result()

        try:
            import librosa
            import numpy as np

            audio_buffer = io.BytesIO(audio_file)
            y, sr = librosa.load(audio_buffer, sr=16000)

            speech_rate = self._calculate_speech_rate(y, sr)
            pause_ratio = self._calculate_pause_ratio(y, sr)
            fluency_score = self._calculate_fluency_score(y, sr)
            confidence = self._estimate_confidence(y, sr)
            clarity_score = self._estimate_clarity(y, sr)

            result: dict[str, Any] = {
                "speech_rate": round(speech_rate, 1),
                "pause_ratio": round(pause_ratio, 3),
                "fluency_score": round(fluency_score, 3),
                "confidence": round(confidence, 3),
                "clarity_score": round(clarity_score, 3),
                "emotion_stability": round(max(0.0, min(1.0, 1 - pause_ratio * 0.6)), 3),
                "confidence_label": self._confidence_label(confidence),
                "emotion_label": "稳定",
                "analysis_source": "acoustic",
                "comment": self._build_acoustic_comment(
                    speech_rate=speech_rate,
                    pause_ratio=pause_ratio,
                    clarity_score=clarity_score,
                    confidence=confidence,
                ),
                "details": {
                    "duration_seconds": round(len(y) / sr, 2),
                    "sample_rate": sr,
                    "rms_energy": round(float(np.sqrt(np.mean(y**2))), 4),
                },
            }
            llm_overlay = await self._analyze_with_llm(transcript, result)
            if llm_overlay:
                result["clarity_score"] = round(llm_overlay.get("clarity_score", result["clarity_score"]) / 100.0, 3)
                result["confidence"] = round(llm_overlay.get("confidence_score", result["confidence"] * 100.0) / 100.0, 3)
                result["emotion_stability"] = round(
                    llm_overlay.get("emotion_stability", result["emotion_stability"] * 100.0) / 100.0,
                    3,
                )
                result["confidence_label"] = llm_overlay.get("confidence_label", result["confidence_label"])
                result["emotion_label"] = llm_overlay.get("emotion_label", result["emotion_label"])
                result["comment"] = llm_overlay.get("comment", result["comment"])
                result["analysis_source"] = "acoustic_llm"
            return result
        except Exception as exc:
            logger.warning("Expression analysis failed, fallback to defaults: %s", exc)
            return self._default_result()

    async def _analyze_with_llm(self, transcript: str, acoustic_metrics: dict[str, Any]) -> dict[str, Any] | None:
        text = (transcript or "").strip()
        if len(text) < 8:
            return None
        payload = {
            "transcript": text,
            "speech_rate": acoustic_metrics.get("speech_rate"),
            "pause_ratio": acoustic_metrics.get("pause_ratio"),
            "fluency_score": acoustic_metrics.get("fluency_score"),
            "confidence": acoustic_metrics.get("confidence"),
            "clarity_score": acoustic_metrics.get("clarity_score"),
        }
        try:
            return await LLMServiceInstance.chat_json(
                messages=[{"role": "user", "content": str(payload)}],
                system_prompt=EXPRESSION_SYSTEM_PROMPT,
                temperature=0.2,
                max_tokens=300,
            )
        except Exception as exc:
            logger.warning("Expression LLM analysis failed: %s", exc)
            return None

    def _calculate_speech_rate(self, y, sr) -> float:
        try:
            import librosa

            onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units="frames")
            duration_minutes = len(y) / sr / 60
            if duration_minutes == 0:
                return 0.0
            estimated_chars = len(onset_frames) / 1.5
            return max(0.0, min(500.0, estimated_chars / duration_minutes))
        except Exception:
            return 200.0

    def _calculate_pause_ratio(self, y, sr) -> float:
        try:
            import librosa
            import numpy as np

            frame_length = int(0.025 * sr)
            hop_length = int(0.010 * sr)
            rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
            threshold = np.mean(rms) * 0.2
            silent_frames = np.sum(rms < threshold)
            total_frames = len(rms)
            if total_frames == 0:
                return 0.0
            return max(0.0, min(1.0, silent_frames / total_frames))
        except Exception:
            return 0.15

    def _calculate_fluency_score(self, y, sr) -> float:
        try:
            import librosa
            import numpy as np

            pause_ratio = self._calculate_pause_ratio(y, sr)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            if len(onset_env) > 1:
                cv = np.std(onset_env) / (np.mean(onset_env) + 1e-8)
                stability_score = max(0.0, 1 - cv * 0.3)
            else:
                stability_score = 0.7
            fluency = 0.6 * (1 - pause_ratio) + 0.4 * stability_score
            return max(0.0, min(1.0, fluency))
        except Exception:
            return 0.75

    def _estimate_confidence(self, y, sr) -> float:
        try:
            import librosa
            import numpy as np

            rms = librosa.feature.rms(y=y)[0]
            if len(rms) > 1 and np.mean(rms) > 0:
                volume_cv = np.std(rms) / np.mean(rms)
                volume_score = max(0.0, 1 - volume_cv)
            else:
                volume_score = 0.7
            avg_volume = float(np.mean(rms)) if len(rms) > 0 else 0.0
            volume_level = min(1.0, avg_volume / 0.05) if avg_volume > 0 else 0.5
            pause_score = 1 - self._calculate_pause_ratio(y, sr)
            confidence = 0.3 * volume_score + 0.3 * volume_level + 0.4 * pause_score
            return max(0.0, min(1.0, confidence))
        except Exception:
            return 0.75

    def _estimate_clarity(self, y, sr) -> float:
        try:
            import librosa
            import numpy as np

            centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
            centroid_score = min(1.0, float(np.mean(centroid)) / 2500.0)
            bandwidth_score = 1.0 - min(1.0, float(np.std(bandwidth)) / 2500.0)
            return max(0.0, min(1.0, centroid_score * 0.5 + bandwidth_score * 0.5))
        except Exception:
            return 0.7

    def _confidence_label(self, confidence: float) -> str:
        if confidence >= 0.82:
            return "高"
        if confidence >= 0.65:
            return "中"
        return "偏低"

    def _build_acoustic_comment(
        self,
        *,
        speech_rate: float,
        pause_ratio: float,
        clarity_score: float,
        confidence: float,
    ) -> str:
        parts = []
        if speech_rate < 120:
            parts.append("语速偏慢")
        elif speech_rate > 320:
            parts.append("语速偏快")
        else:
            parts.append("语速基本合适")
        parts.append("停顿较多" if pause_ratio > 0.28 else "停顿控制尚可")
        parts.append("清晰度较好" if clarity_score >= 0.72 else "清晰度一般")
        parts.append("自信度较高" if confidence >= 0.75 else "自信度仍可提升")
        return "，".join(parts)

    def _default_result(self) -> dict[str, Any]:
        return {
            "speech_rate": 200.0,
            "pause_ratio": 0.15,
            "fluency_score": 0.75,
            "confidence": 0.75,
            "clarity_score": 0.7,
            "emotion_stability": 0.75,
            "confidence_label": "中",
            "emotion_label": "稳定",
            "analysis_source": "fallback",
            "comment": "未获取到有效表达分析样本，返回默认值。",
            "details": {
                "duration_seconds": 0.0,
                "sample_rate": 16000,
                "rms_energy": 0.0,
                "note": "fallback",
            },
        }


ExpressionAnalyzerInstance = ExpressionAnalyzer()
