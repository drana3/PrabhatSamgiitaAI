from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LocalRegisterWrite(BaseModel):
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
