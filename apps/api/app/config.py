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
    api_cors_origins: str = Field(default="http://localhost:3000", alias="API_CORS_ORIGINS")
    trusted_hosts: str = Field(
        default="localhost,127.0.0.1,testserver,acceptance",
        alias="TRUSTED_HOSTS",
    )
    max_request_bytes: int = Field(default=1_048_576, alias="MAX_REQUEST_BYTES", ge=1024)
    admin_api_key_hash: str | None = Field(default=None, alias="ADMIN_API_KEY_HASH")
    scheduler_enabled: bool = Field(default=False, alias="SCHEDULER_ENABLED")
    cache_ttl_seconds: int = Field(default=300, alias="CACHE_TTL_SECONDS", ge=1)
    cache_max_entries: int = Field(default=500, alias="CACHE_MAX_ENTRIES", ge=1)
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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
