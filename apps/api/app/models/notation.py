from sqlalchemy import Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Notation(Base, TimestampMixin):
    __tablename__ = "notations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1024))
    notation_text: Mapped[str | None] = mapped_column(Text)
    scale: Mapped[str | None] = mapped_column(String(64))
    verification_status: Mapped[str] = mapped_column(
        String(32), default="verified", server_default="verified", nullable=False
    )
    metadata_json: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
