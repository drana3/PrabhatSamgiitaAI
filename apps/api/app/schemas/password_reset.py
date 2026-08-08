from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class ForgotPasswordWrite(BaseModel):
    email: EmailStr


class ResetPasswordWrite(BaseModel):
    token: str = Field(min_length=16, max_length=256)
    password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str
