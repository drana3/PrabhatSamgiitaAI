"""The language catalog and the dance list are the same on the phone and on the server.

The phone keeps its own copy (apps/mobile/lib/kirtan/languages.ts and types.ts) so the picker
works offline; this test reads that file and fails when the two drift apart (add a language in
both places, see docs/kiirtan-sets.md).
"""

from __future__ import annotations

import re
from pathlib import Path

from app.models.recordings import DANCES, KIND_LANGUAGE_RULE
from app.services.recording_languages import LANGUAGES, OTHER

MOBILE = Path(__file__).resolve().parents[2] / "mobile" / "lib" / "kirtan"


def _read(name: str) -> str:
    return (MOBILE / name).read_text(encoding="utf8")


def test_catalog_matches_the_phone() -> None:
    phone = re.findall(r'\{ code: "([a-z]{2,3})", english: "([^"]+)" \}', _read("languages.ts"))
    assert phone, "could not read the phone's language list"
    assert tuple(phone) == tuple(LANGUAGES)


def test_other_is_not_a_catalog_entry_and_matches_the_phone() -> None:
    assert OTHER == "other"
    assert OTHER not in {code for code, _ in LANGUAGES}
    assert 'OTHER_LANGUAGE = "other"' in _read("languages.ts")


def test_dances_match_the_phone() -> None:
    match = re.search(r"DANCES = \[([^\]]+)\] as const", _read("types.ts"))
    assert match
    phone = tuple(re.findall(r'"([a-z_]+)"', match.group(1)))
    assert phone == tuple(DANCES)


def test_language_rule_per_kind_matches_the_phone() -> None:
    block = re.search(r"KIND_LANGUAGE_RULE[^=]*= \{(.*?)\n\}", _read("types.ts"), re.S)
    assert block
    phone = dict(re.findall(r"(\w+): \"(none|optional|required)\"", block.group(1)))
    assert phone == KIND_LANGUAGE_RULE
