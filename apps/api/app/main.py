from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore[import-untyped]
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.core.db import SessionLocal, engine
from app.core.middleware import RequestContextMiddleware
from app.logging import configure_logging
from app.models import Base
from app.services.bootstrap import BootstrapService
from app.services.embedding_index import build_embedding_indexes

settings = get_settings()
configure_logging(settings.log_level)
scheduler = AsyncIOScheduler()
DATA_DIR = Path(__file__).resolve().parents[4] / "data"
logger = logging.getLogger(__name__)


def _run_alembic_migrations() -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(config, "head")


async def initialize_schema() -> None:
    try:
        await asyncio.to_thread(_run_alembic_migrations)
        for statement, label in (
            ("CREATE EXTENSION IF NOT EXISTS vector", "vector"),
            ("CREATE EXTENSION IF NOT EXISTS pg_trgm", "pg_trgm"),
            ("CREATE EXTENSION IF NOT EXISTS unaccent", "unaccent"),
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(statement))
            except Exception:
                logger.exception("Skipping optional extension setup for %s", label)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Existing deployments used VARCHAR(255), but canonical theme sets can
            # exceed that length. This idempotent widening runs before data import.
            await conn.execute(text("ALTER TABLE songs ALTER COLUMN theme TYPE TEXT"))
            await conn.execute(text("ALTER TABLE inventory_items ALTER COLUMN title TYPE TEXT"))
    except Exception:
        logger.exception("Database initialization skipped because the database is unavailable")


async def bootstrap_data() -> None:
    try:
        async with SessionLocal() as session:
            await BootstrapService(session, DATA_DIR).ensure_seed_data()
    except Exception:
        logger.exception("Background bootstrap failed")


async def initialize_catalog_and_embeddings() -> None:
    await bootstrap_data()
    await build_embedding_indexes(settings)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await initialize_schema()
    if settings.scheduler_enabled:
        scheduler.start()
    bootstrap_task = asyncio.create_task(initialize_catalog_and_embeddings())
    try:
        yield
    finally:
        bootstrap_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await bootstrap_task
        if settings.scheduler_enabled:
            scheduler.shutdown(wait=False)
        await engine.dispose()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

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
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[host.strip() for host in settings.trusted_hosts.split(",") if host.strip()],
)
app.add_middleware(RequestContextMiddleware, max_request_bytes=settings.max_request_bytes)

app.include_router(v1_router)
