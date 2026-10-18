"""Generate the mapping audit report (JSON + Markdown).

Run with::

    python -m app.services.transliteration.audit
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.services.transliteration.engine import ENGINE_VERSION, transliterate
from app.services.transliteration.mapping import (
    RULESET_VERSION,
    ConsonantRule,
    MarkRule,
    VowelRule,
    all_rules,
)

_REPO_ROOT = Path(__file__).resolve().parents[5]
_DOCS = _REPO_ROOT / "docs"
AUDIT_JSON = _DOCS / "transliteration-mapping-audit.json"
AUDIT_MD = _DOCS / "transliteration-mapping-audit.md"


def _target(rule: object) -> str:
    if isinstance(rule, VowelRule):
        if rule.matra:
            return f"{rule.independent} / -{rule.matra}"
        return f"{rule.independent} / (inherent)"
    if isinstance(rule, (ConsonantRule, MarkRule)):
        return rule.glyph
    return ""


def build_audit() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for match_key, rule in all_rules():
        # Smoke-test each consonant/vowel token in a trivial context.
        probe = match_key if isinstance(rule, (VowelRule,)) else match_key + "A"
        try:
            transliterate(probe)
            test_status = "pass"
        except Exception as exc:  # pragma: no cover - defensive
            test_status = f"error: {exc}"
        rows.append(
            {
                "source_token": match_key,
                "normalized_token": match_key,
                "target_devanagari": _target(rule),
                "rule_id": rule.rule_id,
                "rule_source": rule.source,
                "unambiguous": rule.unambiguous,
                "kind": rule.kind.value,
                "test_status": test_status,
                "note": rule.note,
                "foreign": getattr(rule, "foreign", False),
            }
        )
    return rows


def write_reports() -> None:
    rows = build_audit()
    _DOCS.mkdir(parents=True, exist_ok=True)
    AUDIT_JSON.write_text(
        json.dumps(
            {
                "ruleset_version": RULESET_VERSION,
                "engine_version": ENGINE_VERSION,
                "total_mappings": len(rows),
                "mappings": rows,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    lines = [
        "# Transliteration mapping audit",
        "",
        f"- Ruleset version: `{RULESET_VERSION}`",
        f"- Engine version: `{ENGINE_VERSION}`",
        f"- Total mappings: **{len(rows)}**",
        "",
        "| Token | Devanagari | Rule ID | Source | Unambiguous | Kind | Test | Note |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in rows:
        note = r["note"].replace("|", "\\|")
        lines.append(
            f"| `{r['source_token']}` | {r['target_devanagari']} | {r['rule_id']} | "
            f"{r['rule_source']} | {r['unambiguous']} | {r['kind']} | {r['test_status']} | {note} |"
        )
    AUDIT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {AUDIT_JSON}")
    print(f"wrote {AUDIT_MD}")


if __name__ == "__main__":
    write_reports()
