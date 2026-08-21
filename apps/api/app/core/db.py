from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.core.database_url import normalize_async_database_url

settings = get_settings()


def _engine_kwargs(database_url: str) -> dict[str, object]:
    kwargs: dict[str, object] = {
        "echo": False,
        "pool_pre_ping": True,
    }
    if "neon.tech" in database_url or "-pooler" in database_url:
        # Neon pooled connections are PgBouncer transaction mode.
        kwargs["poolclass"] = NullPool
        kwargs["connect_args"] = {"prepare_threshold": None}
    else:
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 10
        if database_url.startswith("postgresql"):
            kwargs["connect_args"] = {"prepare_threshold": None}
    return kwargs


_ASYNC_DATABASE_URL = normalize_async_database_url(settings.database_url)
engine = create_async_engine(_ASYNC_DATABASE_URL, **_engine_kwargs(_ASYNC_DATABASE_URL))
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
