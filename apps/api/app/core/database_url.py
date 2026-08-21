def normalize_async_database_url(database_url: str) -> str:
    """Force the async psycopg driver. Plain postgresql:// defaults to psycopg2 and crashes import."""
    url = database_url.strip()
    if not url:
        return url
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url
