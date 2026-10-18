from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services.phone_numbers import mask_phone_e164, normalize_phone


def test_normalize_indian_mobile_to_e164() -> None:
    e164, region = normalize_phone("IN", "9876543210")
    assert e164 == "+919876543210"
    assert region == "IN"


def test_rejects_invalid_indian_mobile() -> None:
    with pytest.raises(HTTPException) as error:
        normalize_phone("IN", "5876543210")
    assert error.value.status_code == 422


def test_mask_phone_e164() -> None:
    assert mask_phone_e164("+919876543210") == "+********3210"
