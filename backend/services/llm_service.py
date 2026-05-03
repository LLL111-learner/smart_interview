"""LLM service wrapper."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, AsyncGenerator

from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """OpenAI-compatible async client for local or remote LLM services."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            base_url=settings.LLM_BASE_URL,
            api_key=settings.LLM_API_KEY,
            timeout=120.0,
        )
        self.model = settings.LLM_MODEL
        self.max_retries = 1

    async def chat(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        full_messages: list[dict[str, str]] = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        for attempt in range(self.max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=full_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return response.choices[0].message.content or ""
            except Exception as exc:
                logger.warning("LLM request failed on attempt %s: %s", attempt + 1, exc)
                if attempt == self.max_retries - 1:
                    raise RuntimeError(f"LLM request failed: {exc}") from exc
        return ""

    async def chat_json(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        raw = await self.chat(
            messages=messages,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        payload = self.extract_json_object(raw)
        if not payload:
            raise ValueError("LLM response did not contain a JSON object")
        return json.loads(payload)

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        full_messages: list[dict[str, str]] = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as exc:
            logger.error("LLM stream request failed: %s", exc)
            raise RuntimeError(f"LLM stream request failed: {exc}") from exc

    @staticmethod
    def extract_json_object(raw: str) -> str:
        text = (raw or "").strip()
        if not text:
            return ""
        fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, flags=re.S)
        if fenced:
            return fenced.group(1)
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return ""
        return text[start : end + 1]


LLMServiceInstance = LLMService()
