from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.core.db import SessionLocal, engine
from app.logging import configure_logging
from app.models import Base
from app.services.bootstrap import BootstrapService

settings = get_settings()
configure_logging(settings.log_level)
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        await BootstrapService(session, Path("data/seed")).ensure_seed_data()
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

allowed_origins = [
    origin.strip() for origin in settings.api_cors_origins.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)
