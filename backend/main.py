"""FastAPI entrypoint."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api import api_router
from config import settings
from database import init_db
from services.rag_service import RAGServiceInstance

os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()
    logger.info("Initializing RAG knowledge base...")
    await RAGServiceInstance.init_knowledge_base()
    logger.info("Application started")
    yield
    logger.info("Application shutdown")


app = FastAPI(
    title="AI 模拟面试与能力提升平台",
    description="提供岗位化模拟面试、多轮追问、报告评估与成长分析。",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = Path(settings.AUDIO_UPLOAD_DIR).resolve().parent
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(api_router, prefix="/api/v1")


@app.get("/", summary="Root")
async def root():
    return {
        "message": "AI 模拟面试服务运行中",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", summary="Health Check")
async def health_check():
    return {
        "status": "healthy",
        "llm_model": settings.LLM_MODEL,
        "llm_base_url": settings.LLM_BASE_URL,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("APP_PORT", "8010"))
    dev_reload = os.getenv("APP_RELOAD", "").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=dev_reload,
        reload_excludes=[
            "uploads/**",
            "**/__pycache__/**",
            "*.db",
            "*.db-*",
            "*.log",
        ],
        log_level="info",
    )
