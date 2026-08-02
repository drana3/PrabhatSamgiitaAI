from __future__ import annotations

from pathlib import Path

from app.models import Base


def test_member_quiz_tables_registered_for_create_all() -> None:
    tables = Base.metadata.tables
    assert "user_accounts" in tables
    assert "quiz_attempts" in tables
    assert "quiz_certifications" in tables
    assert "is_admin" in tables["user_accounts"].c


def test_initialize_schema_keeps_member_ddl_after_alembic_failure() -> None:
    source = Path(__file__).resolve().parents[1] / "app" / "main.py"
    text = source.read_text(encoding="utf-8")
    assert "async def _ensure_member_schema()" in text
    assert "ADD COLUMN IF NOT EXISTS is_admin" in text
    assert "Alembic upgrade failed; continuing with idempotent schema ensure" in text
    assert "await _ensure_member_schema()" in text
    # ensure path is outside the alembic try/except success-only block
    alembic_fail_idx = text.index(
        "Alembic upgrade failed; continuing with idempotent schema ensure"
    )
    ensure_call_idx = text.index("await _ensure_member_schema()")
    assert ensure_call_idx > alembic_fail_idx
