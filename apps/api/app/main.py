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
from app.observability import harden_logging, init_sentry
from app.services.ai_quota_report import EXPOSED_HEADERS
from app.services.bootstrap import BootstrapService
from app.services.embedding_index import build_embedding_indexes, load_faiss_snapshot
from app.services.rate_limit import RateLimitMiddleware, default_store
from app.services.rate_limit import limiter as rate_limiter

settings = get_settings()
configure_logging(settings.log_level)
harden_logging()
init_sentry(settings)
scheduler = AsyncIOScheduler()
DATA_DIR = Path(__file__).resolve().parents[4] / "data"
logger = logging.getLogger(__name__)


def _run_alembic_migrations() -> None:
    from alembic.config import Config

    from alembic import command

    config = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(config, "head")


async def _ensure_member_schema() -> None:
    """Idempotent member DDL that must run even when Alembic is stuck or OOM-killed.

    create_all creates quiz_attempts / quiz_certifications and other ORM tables.
    Explicit ADD COLUMN covers older user_accounts rows that predate is_admin
    (create_all does not add missing columns on existing tables).
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "ALTER TABLE user_accounts "
                "ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_user_accounts_is_admin "
                "ON user_accounts (is_admin)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE user_interest_profiles "
                "ADD COLUMN IF NOT EXISTS monthly_summaries JSONB NOT NULL DEFAULT '{}'::jsonb"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE user_accounts "
                "ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE user_accounts "
                "ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(20)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE user_accounts "
                "ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(2)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE user_accounts "
                "ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ"
            )
        )
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_accounts_phone_e164 "
                "ON user_accounts (phone_e164)"
            )
        )

    # Non-critical wideners: never block member/admin/quiz schema.
    for statement, label in (
        ("ALTER TABLE songs ALTER COLUMN theme TYPE TEXT", "songs.theme"),
        ("ALTER TABLE inventory_items ALTER COLUMN title TYPE TEXT", "inventory_items.title"),
    ):
        try:
            async with engine.begin() as conn:
                await conn.execute(text(statement))
        except Exception:
            logger.exception("Skipping optional column widen for %s", label)


async def initialize_schema() -> None:
    if settings.app_env == "test":
        return

    try:
        await asyncio.to_thread(_run_alembic_migrations)
    except Exception:
        logger.exception("Alembic upgrade failed; continuing with idempotent schema ensure")

    for statement, label in (
        ("CREATE EXTENSION IF NOT EXISTS pg_trgm", "pg_trgm"),
        ("CREATE EXTENSION IF NOT EXISTS unaccent", "unaccent"),
    ):
        try:
            async with engine.begin() as conn:
                await conn.execute(text(statement))
        except Exception:
            logger.exception("Skipping optional extension setup for %s", label)

    try:
        await _ensure_member_schema()
    except Exception:
        logger.exception("Database initialization skipped because the database is unavailable")


async def bootstrap_data() -> None:
    try:
        async with SessionLocal() as session:
            await BootstrapService(session, DATA_DIR).ensure_seed_data()
    except Exception:
        logger.exception("Background bootstrap failed")


async def initialize_catalog_and_embeddings() -> None:
    from app.services.lyric_search import lyric_index

    await asyncio.gather(bootstrap_data(), asyncio.to_thread(lyric_index))
    await build_embedding_indexes(settings)


def _log_server_tools() -> None:
    """One line at start: which helper programs this server has (never stops the start)."""
    try:
        from app.services.server_tools import tools_summary

        summary = tools_summary(settings)
        logger.info(
            "server tools: %s",
            ", ".join(f"{name}={'yes' if ok else 'NO'}" for name, ok in summary.items()),
        )
    except Exception:  # noqa: BLE001
        logger.warning("could not check the server tools", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await initialize_schema()
    _log_server_tools()
    load_faiss_snapshot(settings)
    if settings.scheduler_enabled:
        scheduler.start()
    bootstrap_task = asyncio.create_task(initialize_catalog_and_embeddings())
    catalog_poll_task = None
    if settings.catalog_poll_enabled and settings.app_env != "test":
        from app.services.catalog_sync import catalog_poll_loop

        catalog_poll_task = asyncio.create_task(catalog_poll_loop())
    try:
        yield
    finally:
        bootstrap_task.cancel()
        if catalog_poll_task is not None:
            catalog_poll_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await bootstrap_task
            if catalog_poll_task is not None:
                await catalog_poll_task
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
    expose_headers=["X-Error-Code", *EXPOSED_HEADERS],
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[host.strip() for host in settings.trusted_hosts.split(",") if host.strip()],
)
app.add_middleware(RequestContextMiddleware, max_request_bytes=settings.max_request_bytes)
if settings.app_env != "test":
    rate_limiter.configure(default_store())
app.add_middleware(RateLimitMiddleware)

app.include_router(v1_router)
