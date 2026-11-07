from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Prabhat Samgiita AI"
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    app_env: str = Field(default="development", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    database_url: str = Field(default="", alias="DATABASE_URL")
    faiss_index_dir: str = Field(default="./data/generated/faiss", alias="FAISS_INDEX_DIR")
    faiss_index_url: str | None = Field(default=None, alias="FAISS_INDEX_URL")
    api_cors_origins: str = Field(default="http://localhost:3000", alias="API_CORS_ORIGINS")
    trusted_hosts: str = Field(
        default="localhost,127.0.0.1,testserver,acceptance",
        alias="TRUSTED_HOSTS",
    )
    max_request_bytes: int = Field(default=1_048_576, alias="MAX_REQUEST_BYTES", ge=1024)
    admin_api_key_hash: str | None = Field(default=None, alias="ADMIN_API_KEY_HASH")
    member_proxy_key: str | None = Field(default=None, alias="MEMBER_PROXY_KEY")
    scheduler_enabled: bool = Field(default=False, alias="SCHEDULER_ENABLED")
    cache_ttl_seconds: int = Field(default=300, alias="CACHE_TTL_SECONDS", ge=1)
    cache_max_entries: int = Field(default=500, alias="CACHE_MAX_ENTRIES", ge=1)
    # Keep in-process catalog memory aligned with Postgres (Neon) without user-visible lag.
    catalog_poll_enabled: bool = Field(default=True, alias="CATALOG_POLL_ENABLED")
    catalog_poll_interval_seconds: int = Field(
        default=600, alias="CATALOG_POLL_INTERVAL_SECONDS", ge=5, le=600
    )
    catalog_poll_initial_delay_seconds: int = Field(
        default=5, alias="CATALOG_POLL_INITIAL_DELAY_SECONDS", ge=0, le=120
    )
    catalog_poll_lookback_minutes: int = Field(
        default=30, alias="CATALOG_POLL_LOOKBACK_MINUTES", ge=1, le=1440
    )
    catalog_poll_overlap_seconds: int = Field(
        default=90, alias="CATALOG_POLL_OVERLAP_SECONDS", ge=0, le=600
    )
    content_source_url: str = Field(
        default="https://prabhatasamgiita.net",
        alias="CONTENT_SOURCE_URL",
    )
    content_cache_dir: str = Field(default="./data/generated/cache", alias="CONTENT_CACHE_DIR")
    public_site_url: str = Field(default="http://localhost:3000", alias="PUBLIC_SITE_URL")
    next_public_api_base_url: str = Field(
        default="http://localhost:8000", alias="NEXT_PUBLIC_API_BASE_URL"
    )
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_BASE_URL")
    openai_model: str = Field(default="gpt-4.1-mini", alias="OPENAI_MODEL")
    azure_openai_endpoint: str | None = Field(default=None, alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_api_key: str | None = Field(default=None, alias="AZURE_OPENAI_API_KEY")
    azure_openai_deployment: str | None = Field(default=None, alias="AZURE_OPENAI_DEPLOYMENT")
    azure_openai_chat_deployment: str | None = Field(
        default=None, alias="AZURE_OPENAI_CHAT_DEPLOYMENT"
    )
    azure_openai_embedding_deployment: str | None = Field(
        default=None, alias="AZURE_OPENAI_EMBEDDING_DEPLOYMENT"
    )
    azure_openai_api_version: str = Field(default="2024-10-21", alias="AZURE_OPENAI_API_VERSION")
    azure_openai_responses_api_version: str = Field(
        default="2025-04-01-preview",
        alias="AZURE_OPENAI_RESPONSES_API_VERSION",
    )
    # Keep in sync with packages/core/src/ai-companion-quota.ts (15 guest / 50 signed-in).
    ai_daily_guest_limit: int = Field(default=15, alias="AI_DAILY_GUEST_LIMIT", ge=1)
    ai_daily_member_limit: int = Field(default=50, alias="AI_DAILY_MEMBER_LIMIT", ge=1)
    default_admin_emails: str = Field(default="", alias="DEFAULT_ADMIN_EMAILS")
    protected_admin_emails: str = Field(default="", alias="PROTECTED_ADMIN_EMAILS")
    acs_email_connection_string: str | None = Field(
        default=None, alias="ACS_EMAIL_CONNECTION_STRING"
    )
    acs_email_from: str | None = Field(default=None, alias="ACS_EMAIL_FROM")
    acs_email_enabled: bool = Field(default=False, alias="ACS_EMAIL_ENABLED")
    # Cloud Translation (NMT). Stay inside Google free tier; over budget → LLM.
    # Google's free allowance is ~500k chars/month; we default lower and hard-cap
    # so billing stays at ₹0 even if the env limit is raised by mistake.
    google_translate_api_key: str | None = Field(default=None, alias="GOOGLE_TRANSLATE_API_KEY")
    google_translate_enabled: bool = Field(default=True, alias="GOOGLE_TRANSLATE_ENABLED")
    google_translate_monthly_char_limit: int = Field(
        default=400_000,
        alias="GOOGLE_TRANSLATE_MONTHLY_CHAR_LIMIT",
        ge=0,
    )
    # When false (default), never exceed FREE_TIER_HARD_CAP regardless of env limit.
    google_translate_allow_paid: bool = Field(default=False, alias="GOOGLE_TRANSLATE_ALLOW_PAID")
    google_translate_quota_path: str = Field(
        default="./data/generated/google_translate_quota.json",
        alias="GOOGLE_TRANSLATE_QUOTA_PATH",
    )

    # Kiirtan / Bhajan recordings (docs/kiirtan-publishing.md). No real credentials here.
    recording_storage_backend: str = Field(default="local", alias="RECORDING_STORAGE_BACKEND")
    recording_local_dir: str = Field(
        default="./data/generated/recordings", alias="RECORDING_LOCAL_DIR"
    )
    recording_max_bytes: int = Field(default=60 * 1024 * 1024, alias="RECORDING_MAX_BYTES", ge=1024)
    recording_signing_secret: str | None = Field(default=None, alias="RECORDING_SIGNING_SECRET")
    recording_upload_ttl_seconds: int = Field(
        default=900, alias="RECORDING_UPLOAD_TTL_SECONDS", ge=60, le=86_400
    )
    recording_terms_version: str = Field(default="2026-11", alias="RECORDING_TERMS_VERSION")
    recording_flag_threshold: int = Field(default=3, alias="RECORDING_FLAG_THRESHOLD", ge=1)
    recording_fpcalc_path: str = Field(default="fpcalc", alias="RECORDING_FPCALC_PATH")
    # How many recordings one member may add in 24 hours (docs/kiirtan-publishing.md, "Duplicates").
    recording_uploads_per_day: int = Field(default=20, alias="RECORDING_UPLOADS_PER_DAY", ge=1)
    # Playlists from an event (docs/kiirtan-sets.md, "Limits"). A team member is not held to the
    # per-day numbers; the per-set cap for the team is only a sanity bound.
    recording_set_max_tracks: int = Field(default=60, alias="RECORDING_SET_MAX_TRACKS", ge=1)
    recording_set_max_tracks_team: int = Field(
        default=200, alias="RECORDING_SET_MAX_TRACKS_TEAM", ge=1
    )
    recording_set_tracks_per_day: int = Field(
        default=60, alias="RECORDING_SET_TRACKS_PER_DAY", ge=1
    )
    recording_sets_per_day: int = Field(default=3, alias="RECORDING_SETS_PER_DAY", ge=1)
    recording_set_empty_drafts: int = Field(default=5, alias="RECORDING_SET_EMPTY_DRAFTS", ge=1)
    # S3-compatible storage (Cloudflare R2). All empty until Dada creates the bucket.
    recording_s3_endpoint: str | None = Field(default=None, alias="RECORDING_S3_ENDPOINT")
    recording_s3_bucket: str | None = Field(default=None, alias="RECORDING_S3_BUCKET")
    recording_s3_region: str = Field(default="auto", alias="RECORDING_S3_REGION")
    recording_s3_access_key_id: str | None = Field(default=None, alias="RECORDING_S3_ACCESS_KEY_ID")
    recording_s3_secret_access_key: str | None = Field(
        default=None, alias="RECORDING_S3_SECRET_ACCESS_KEY"
    )
    recording_public_base_url: str | None = Field(default=None, alias="RECORDING_PUBLIC_BASE_URL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
