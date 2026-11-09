"""Counters of the request limiter, kept in the database so all API instances agree.

One row = one policy-and-key in one time window ("sign_in:ip:ab12…", window starting at 12:00:00).
Keys are hashes: the table never holds an IP address, an e-mail or a member id in the clear.
"""

from __future__ import annotations

from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RateLimitCounter(Base):
    __tablename__ = "rate_limit_counters"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    window_start: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # unix seconds after which the row can be deleted
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
