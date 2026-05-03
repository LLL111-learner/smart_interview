"""API router registry."""

from fastapi import APIRouter

from api.admin import router as admin_router
from api.auth import router as auth_router
from api.growth import router as growth_router
from api.interview import router as interview_router
from api.question import router as question_router
from api.report import router as report_router
from api.tts import router as tts_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(interview_router)
api_router.include_router(question_router)
api_router.include_router(report_router)
api_router.include_router(growth_router)
api_router.include_router(admin_router)
api_router.include_router(tts_router)
