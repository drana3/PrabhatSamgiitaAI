from app.core.database_url import normalize_async_database_url


def test_normalize_async_database_url_upgrades_plain_postgres() -> None:
    assert (
        normalize_async_database_url("postgresql://user:pass@host/db")
        == "postgresql+psycopg://user:pass@host/db"
    )
    assert (
        normalize_async_database_url("postgres://user:pass@host/db")
        == "postgresql+psycopg://user:pass@host/db"
    )


def test_normalize_async_database_url_keeps_psycopg() -> None:
    url = "postgresql+psycopg://user:pass@host/db"
    assert normalize_async_database_url(url) == url
