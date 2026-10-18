from __future__ import annotations

import re

import phonenumbers
from fastapi import HTTPException
from phonenumbers import NumberParseException
from phonenumbers.phonenumberutil import NumberParseException as UtilNumberParseException


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value.strip())


def normalize_phone(country_code: str, national_number: str) -> tuple[str, str]:
    region = country_code.strip().upper()
    if len(region) != 2 or not region.isalpha():
        raise HTTPException(status_code=422, detail="Choose a valid country code.")

    digits = _digits_only(national_number)
    if not digits:
        raise HTTPException(status_code=422, detail="Enter your mobile number.")

    try:
        parsed = phonenumbers.parse(digits, region)
    except (NumberParseException, UtilNumberParseException) as exc:
        raise HTTPException(status_code=422, detail="Enter a valid mobile number.") from exc

    if not phonenumbers.is_valid_number(parsed):
        raise HTTPException(
            status_code=422,
            detail="Enter a valid mobile number for the selected country.",
        )

    number_type = phonenumbers.number_type(parsed)
    if number_type not in {
        phonenumbers.PhoneNumberType.MOBILE,
        phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE,
    }:
        raise HTTPException(
            status_code=422,
            detail="Use a mobile number. Landline numbers are not accepted.",
        )

    e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    return e164, region


def mask_phone_e164(phone_e164: str | None) -> str | None:
    if not phone_e164:
        return None
    digits = _digits_only(phone_e164)
    if len(digits) < 4:
        return phone_e164
    return f"+{'*' * max(0, len(digits) - 4)}{digits[-4:]}"
