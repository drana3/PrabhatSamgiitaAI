from sqlalchemy import Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Media(Base, TimestampMixin):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_number: Mapped[int | None] = mapped_column(Integer, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    embed_url: Mapped[str | None] = mapped_column(String(1024))
    verification_status: Mapped[str] = mapped_column(
        String(32), default="unverified", server_default="unverified", nullable=False
    )
    source_url: Mapped[str | None] = mapped_column(String(1024))
    notes: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
