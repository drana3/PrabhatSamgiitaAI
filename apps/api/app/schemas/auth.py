from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class PhoneFieldsWrite(BaseModel):
    phone_country_code: str = Field(min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    phone_number: str = Field(min_length=4, max_length=20)


class LocalRegisterWrite(PhoneFieldsWrite):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class LocalLoginWrite(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthSessionResponse(BaseModel):
    client_principal: str
    display_name: str
    email: str
    identity_provider: str
    # Signed session tokens (docs/security-member-auth.md). Null without MEMBER_SESSION_SECRET.
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int | None = None


class ProviderExchangeWrite(BaseModel):
    """A provider sign-in proof: id_token (Google, Apple, Microsoft) or access_token (Facebook)."""

    provider: str = Field(min_length=2, max_length=16)
    id_token: str | None = Field(default=None, max_length=8192)
    access_token: str | None = Field(default=None, max_length=4096)
    nonce: str | None = Field(default=None, max_length=256)
    device_label: str | None = Field(default=None, max_length=120)


class RefreshWrite(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=200)


class RevokeWrite(BaseModel):
    refresh_token: str | None = Field(default=None, max_length=200)
    all_devices: bool = False


class TokenPairResponse(BaseModel):
    token_type: str = "Bearer"
    access_token: str
    refresh_token: str
    expires_in: int
    account_id: str
    display_name: str
    email: str | None = None
    identity_provider: str
    is_admin: bool = False
