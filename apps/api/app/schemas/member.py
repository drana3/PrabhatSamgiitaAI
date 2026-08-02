from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MemberProfile(BaseModel):
    authenticated: bool = True
    id: UUID
    display_name: str
    email: str | None = None
    avatar_url: str | None = None
    identity_provider: str
    preferred_language: str | None = None
    country: str | None = None
    personalization_enabled: bool = True
    favorite_song_numbers: list[int] = Field(default_factory=list)


class AnonymousMember(BaseModel):
    authenticated: bool = False


class ChatMemoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatMemoryWrite(BaseModel):
    song_number: int | None = Field(default=None, ge=1, le=5018)
    turns: list[ChatMemoryTurn] = Field(min_length=1, max_length=4)


class ChatMemoryResponse(BaseModel):
    summary: str = ""
    recent_turns: list[ChatMemoryTurn] = Field(default_factory=list)


class FavoriteWrite(BaseModel):
    song_number: int = Field(ge=1, le=5018)


class MemberPreferencesWrite(BaseModel):
    preferred_language: str | None = Field(default=None, max_length=32)
    country: str | None = Field(default=None, max_length=128)
    personalization_enabled: bool | None = None
