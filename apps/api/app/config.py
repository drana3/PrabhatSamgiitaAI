from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Prabhat Samgiita AI"
    app_env: str = Field(default="development", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    database_url: str = Field(alias="DATABASE_URL")
    api_cors_origins: str = Field(default="http://localhost:3000", alias="API_CORS_ORIGINS")
    content_source_url: AnyHttpUrl = Field(
        default="https://prabhatasamgiita.net", alias="CONTENT_SOURCE_URL"
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
    azure_openai_api_version: str = Field(default="2024-10-21", alias="AZURE_OPENAI_API_VERSION")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
