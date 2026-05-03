"""Application settings."""

from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./smart_interview.db"

    LLM_BASE_URL: str = "http://localhost:11434/v1"
    LLM_MODEL: str = "qwen2.5:3b"
    LLM_API_KEY: str = "ollama"

    ASR_BASE_URL: str = ""
    ASR_MODEL: str = ""
    ASR_API_KEY: str = ""
    ASR_LOCAL_MODEL: str = ""
    ASR_LOCAL_DEVICE: str = "cpu"
    ASR_LOCAL_COMPUTE_TYPE: str = "default"

    TTS_VOICE: str = "zh-CN-XiaoxiaoNeural"
    TTS_FORMAT: str = "mp3"

    SECRET_KEY: str = "smart-interview-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    KNOWLEDGE_BASE_PATH: str = "../knowledge_base"
    AUDIO_UPLOAD_DIR: str = "./uploads/audio"

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
