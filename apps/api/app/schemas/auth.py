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
