"""The team's pins for the phone's search menu (docs/search-menu.md).

One row per pinned shelf id, in `position` order. The id is the shelf id the phone's menu rules make
("ps", "kiirtan:folk", "baba_audio", ...); the table does not list the valid ids because the phone
decides which shelves exist. A pin for a shelf that does not exist (yet) is simply not shown.
"""

from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SearchMenuPin(Base, TimestampMixin):
    __tablename__ = "search_menu_pins"

    shelf_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pinned_by: Mapped[str | None] = mapped_column(String(120))
