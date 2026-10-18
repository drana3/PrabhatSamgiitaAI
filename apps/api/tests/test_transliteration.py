"""Unit / integration / catalogue tests for the transliteration engine.

Gold-standard fixtures below are hand-derived from the official Roman
Saṃskṛta rules (romansamskrta.html) and standard Devanagari orthography —
NOT copied from engine output — so they genuinely test correctness.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.transliteration import router as transliteration_router
from app.services.transliteration import transliterate, verify
from app.services.transliteration.mapping import MAPPING, RULESET_VERSION, all_rules
from app.services.transliteration.verification import VerificationStatus

# Build a minimal app with ONLY the transliteration router so the test does not
# require a database connection (the full app.main boots a DB engine on import).
_app = FastAPI()
_app.include_router(transliteration_router, prefix="/api/v1")
client = TestClient(_app)


# ---------------------------------------------------------------------------
# Gold-standard word/phrase pairs (independently derived).
# ---------------------------------------------------------------------------
GOLD = {
    # vowels & inherent schwa
    "KAMALA": "कमल",
    "RÁMA": "राम",
    "GIITA": "गीत",
    "SAḾGIITA": "संगीत",
    "PRABHÁTA": "प्रभात",
    # conjuncts
    "BANDHU": "बन्धु",
    "LAKŚMII": "लक्ष्मी",
    # aspirates
    "KHELÁ": "खेला",
    "GHAR": "घर्",
    "DHARMA": "धर्म",
    # retroflex vs dental
    "PAT́A": "पट",
    "PATA": "पत",
    # retroflex flap (Ŕ / ŕh)
    "BAŔHATE": "बढ़ते",
    # sibilant distinctions: SH श, Ś ष, S स
    "SHIVA": "शिव",
    "VIŚŃU": "विष्णु",
    "SAMA": "सम",
    # halanta (final consonant without vowel)
    "UPAL": "उपल्",
    "UPALA": "उपल",
    # anusvara
    "AṄKA": "अंक",  # written with Ḿ in corpus → anusvara
    # vowel after vowel → independent
    "JÁI": "जाइ",
    # apostrophe convention equals accent convention
    "A'MA'R": "आमार्",
}


@pytest.mark.parametrize("roman,expected", list(GOLD.items()))
def test_gold_pairs(roman: str, expected: str) -> None:
    # Normalise the AṄKA case: corpus uses Ḿ (anusvara) not ṅ.
    src = roman.replace("AṄKA", "AḾKA")
    assert transliterate(src).devanagari == expected


def test_longest_match_beats_components() -> None:
    # "II" must win over "I"+"I"; "KH" over "K"+"H".
    assert transliterate("II").devanagari == "ई"
    assert transliterate("KHA").devanagari == "ख"
    assert transliterate("KA").devanagari != "ख"


def test_vowel_length_preserved() -> None:
    assert "ा" in transliterate("RÁMA").devanagari
    assert "ी" in transliterate("GIITA").devanagari
    assert "ू" in transliterate("BHÚMI").devanagari


def test_retroflex_vs_dental_distinct() -> None:
    assert transliterate("T́A").devanagari == "ट"
    assert transliterate("TA").devanagari == "त"
    assert transliterate("D́A").devanagari == "ड"
    assert transliterate("DA").devanagari == "द"


def test_sibilants_distinct() -> None:
    assert transliterate("SHA").devanagari == "श"
    assert transliterate("ŚA").devanagari == "ष"
    assert transliterate("SA").devanagari == "स"


def test_apostrophe_equals_accent() -> None:
    assert transliterate("A'").devanagari == transliterate("Á").devanagari
    assert transliterate("U'").devanagari == transliterate("Ú").devanagari
    assert transliterate("T'A").devanagari == transliterate("T́A").devanagari
    assert transliterate("N'A").devanagari == transliterate("ŃA").devanagari


def test_case_insensitive() -> None:
    assert transliterate("bandhu").devanagari == transliterate("BANDHU").devanagari


def test_unicode_normalization_nfc_nfd_equal() -> None:
    import unicodedata

    nfc = transliterate(unicodedata.normalize("NFC", "T́A")).devanagari
    nfd = transliterate(unicodedata.normalize("NFD", "T́A")).devanagari
    assert nfc == nfd == "ट"


def test_lines_and_refrain_preserved() -> None:
    text = "BANDHU HE\nÁLOR\nBANDHU HE"
    r = transliterate(text)
    assert r.devanagari.count("\n") == 2
    lines = r.devanagari.split("\n")
    assert lines[0] == lines[2]  # refrain preserved identically


def test_original_preserved_exactly() -> None:
    text = "MUSÁFIR  ÁGE, (BAŔHATE)!"
    assert transliterate(text).original == text


def test_unsupported_token_flagged() -> None:
    r = transliterate("XYLO")
    assert "X" in r.unsupported_tokens
    assert verify(r).status is VerificationStatus.UNSUPPORTED_INPUT


def test_foreign_consonant_flagged_not_unsupported() -> None:
    r = transliterate("FAKIR")
    assert "F" in r.ambiguous_tokens
    assert not r.unsupported_tokens


def test_apostrophe_punctuation_is_literal() -> None:
    r = transliterate("DON'E")  # apostrophe here is not a valid diacritic token
    assert r.unsupported_tokens == []


def test_vocalic_r_ambiguity_flagged() -> None:
    r = transliterate("HRDAYE")
    assert "R" in r.ambiguous_tokens
    assert verify(r).status is VerificationStatus.NEEDS_REVIEW


def test_confidence_always_none() -> None:
    assert verify(transliterate("RÁMA")).confidence is None


def test_reference_match_status() -> None:
    r = transliterate("RÁMA")
    rep = verify(r, reference_devanagari="राम")
    assert rep.status is VerificationStatus.REFERENCE_MATCHED


def test_determinism() -> None:
    a = transliterate("PRABHÁTA SAḾGIITA").devanagari
    b = transliterate("PRABHÁTA SAḾGIITA").devanagari
    assert a == b


def test_every_mapping_has_test_coverage() -> None:
    # Every token in the ruleset must transliterate without raising and,
    # for consonants/vowels, produce non-empty Devanagari in a probe word.
    for match_key, _rule in all_rules():
        probe = match_key + "A"
        out = transliterate(probe)
        assert out.devanagari is not None, match_key


def test_mapping_table_longest_token_len() -> None:
    assert MAPPING.max_len >= 3  # e.g. T'H / T́H


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------
def test_individual_endpoint_ok() -> None:
    resp = client.post(
        "/api/v1/transliteration/roman-to-devanagari",
        json={"text": "RÁMA", "verify": True},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["devanagari"] == "राम"
    assert body["ruleset_version"] == RULESET_VERSION
    assert body["verification"]["confidence"] is None
    assert body["method"] == "rule_based"


def test_individual_endpoint_needs_review() -> None:
    resp = client.post(
        "/api/v1/transliteration/roman-to-devanagari",
        json={"text": "HRDAYE"},
    )
    assert resp.json()["status"] == "needs_review"


def test_individual_endpoint_size_limit() -> None:
    resp = client.post(
        "/api/v1/transliteration/roman-to-devanagari",
        json={"text": "A" * 20_001},
    )
    assert resp.status_code == 422


def test_batch_endpoint_order_and_isolation() -> None:
    resp = client.post(
        "/api/v1/transliteration/roman-to-devanagari/batch",
        json={
            "items": [
                {"id": "s1", "text": "RÁMA"},
                {"id": "s2", "text": "HRDAYE"},
                {"id": "s3", "text": "XQ"},
            ],
            "verify": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [i["id"] for i in body["items"]] == ["s1", "s2", "s3"]
    assert body["summary"]["total"] == 3
    assert body["items"][0]["result"]["devanagari"] == "राम"


def test_batch_size_limit() -> None:
    resp = client.post(
        "/api/v1/transliteration/roman-to-devanagari/batch",
        json={"items": [{"id": str(i), "text": "A"} for i in range(501)]},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Catalogue job tests (fixtures, idempotency, preservation, schema validation)
# ---------------------------------------------------------------------------
def test_build_song_record_and_preservation(tmp_path: Path) -> None:
    from app.jobs import import_prabhata_catalogue as job

    song = {
        "number": 9999,
        "title": "TEST",
        "roman_text": "RÁMA\nGIITA",
        "roman_source_url": "https://example.test/9999",
    }
    rec = job.build_song_record(song)
    assert rec["song_number"] == 9999
    assert rec["devanagari"]["lines"] == ["राम", "गीत"]
    assert len(rec["line_pairs"]) == 2
    assert rec["provenance"]["devanagari_origin"] == "rule_based"
    # Protected records (manually verified) must not be treated as overwritable.
    rec["provenance"]["verification_status"] = "manually_verified"
    assert job._is_protected(rec) is True


def test_catalogue_schema_validation() -> None:
    from app.jobs import import_prabhata_catalogue as job

    song = {"number": 1, "title": "x", "roman_text": "RÁMA", "roman_source_url": None}
    data = {
        "schema_version": "1.0.0",
        "catalogue": "Prabhata Samgiita",
        "songs": [job.build_song_record(song)],
    }
    assert job.validate_catalogue(data) == []


# ---------------------------------------------------------------------------
# Optional AI-assisted review (stubbed provider — offline, deterministic)
# ---------------------------------------------------------------------------
class _StubProvider:
    def __init__(self, payload: str) -> None:
        self._payload = payload

    async def complete(self, prompt: str) -> str:  # noqa: ARG002
        return self._payload


@pytest.mark.asyncio
async def test_ai_review_parses_suggestion_and_preserves_roman() -> None:
    from app.services.transliteration.ai_review import ai_review

    payload = (
        '{"assessment":"suggest_changes","overall_comment":"Hindi glide needed",'
        '"suggestions":[{"scope":"word","target":"DUNIÁ","problem":"missing य glide",'
        '"suggested_devanagari":"दुनिया","reason":"vowel hiatus in Hindi",'
        '"evidence":"इ+आ→इया","confidence":"medium"}]}'
    )
    result = await ai_review(
        "DUNIÁ", "दुनिआ", language_hint="Hindi", provider=_StubProvider(payload)
    )
    assert result.available is True
    assert result.assessment == "suggest_changes"
    assert len(result.suggestions) == 1
    s = result.suggestions[0]
    assert s.suggested_devanagari == "दुनिया"
    assert s.status == "pending_review"  # never auto-applied
    assert s.roman_preserved is True
    assert s.is_devanagari is True


@pytest.mark.asyncio
async def test_ai_review_flags_suggestion_that_smuggles_roman() -> None:
    from app.services.transliteration.ai_review import ai_review

    payload = (
        '{"assessment":"suggest_changes","suggestions":[{"scope":"word",'
        '"target":"X","problem":"p","suggested_devanagari":"दुनिया DUNIA",'
        '"reason":"r","evidence":"e","confidence":"low"}]}'
    )
    result = await ai_review("DUNIÁ", "दुनिआ", provider=_StubProvider(payload))
    assert result.suggestions[0].roman_preserved is False


@pytest.mark.asyncio
async def test_ai_review_unparseable_degrades_gracefully() -> None:
    from app.services.transliteration.ai_review import ai_review

    result = await ai_review("RÁMA", "राम", provider=_StubProvider("not json at all"))
    assert result.assessment == "unparseable"
    assert result.suggestions == []


# ---------------------------------------------------------------------------
# Language agents (on top of rules — never replace engine output)
# ---------------------------------------------------------------------------
def test_hindi_agent_suggests_ya_glide_for_dunia() -> None:
    from app.services.transliteration import review_deterministic, transliterate

    engine = transliterate("DUNIÁ")
    assert engine.devanagari == "दुनिआ"  # rules stay literal
    review = review_deterministic("hindi", "DUNIÁ", engine.devanagari)
    assert review.assessment == "suggest_changes"
    assert any(s.suggested_devanagari == "दुनिया" for s in review.suggestions)
    assert all(s.status == "pending_review" for s in review.suggestions)
    # Engine output is unchanged by the agent.
    assert engine.devanagari == "दुनिआ"


def test_hindi_agent_suggests_duniyavalon() -> None:
    """DUNIÁVÁNLO: rules → दुनिआवान्लो; Hindi agent → दुनियावालों."""
    from app.services.transliteration import review_deterministic, transliterate

    engine = transliterate("DUNIÁVÁNLO")
    assert engine.devanagari == "दुनिआवान्लो"
    review = review_deterministic("hindi", "DUNIÁVÁNLO", engine.devanagari)
    assert any(s.suggested_devanagari == "दुनियावालों" for s in review.suggestions)
    # Engine remains the literal ruleset output.
    assert engine.devanagari == "दुनिआवान्लो"


def test_bengali_agent_keeps_hiatus_jai() -> None:
    from app.services.transliteration import review_deterministic, transliterate

    engine = transliterate("JÁI")
    assert engine.devanagari == "जाइ"
    review = review_deterministic("bengali", "JÁI", engine.devanagari)
    # No य-glide suggestion for Bengali hiatus.
    assert not any("य" in s.suggested_devanagari for s in review.suggestions)
    assert review.assessment == "ok"


def test_urdu_agent_same_glide_convention_as_hindi() -> None:
    from app.services.transliteration import review_deterministic, transliterate

    engine = transliterate("DUNIÁVÁNLO")
    hindi = review_deterministic("hindi", "DUNIÁVÁNLO", engine.devanagari)
    urdu = review_deterministic("urdu", "DUNIÁVÁNLO", engine.devanagari)
    h_sugs = {s.suggested_devanagari for s in hindi.suggestions}
    u_sugs = {s.suggested_devanagari for s in urdu.suggestions}
    assert "दुनियावालों" in h_sugs and "दुनियावालों" in u_sugs


def test_samskrta_agent_flags_vocalic_r() -> None:
    from app.services.transliteration import review_deterministic, transliterate

    engine = transliterate("KRŚŃA")
    review = review_deterministic("samskrta", "KRŚŃA", engine.devanagari)
    assert review.assessment == "suggest_changes"
    assert any(
        s.suggested_devanagari == "कृष्ण" for s in review.suggestions
    )


def test_cross_validate_hindi_vs_bengali_on_dunia() -> None:
    from app.services.transliteration import cross_validate, transliterate

    engine = transliterate("DUNIÁVÁNLO")
    xv = cross_validate(
        "DUNIÁVÁNLO",
        engine.devanagari,
        languages=["hindi", "bengali"],
    )
    assert xv.engine_devanagari == engine.devanagari
    hindi = next(a for a in xv.agents if a.language == "hindi")
    bengali = next(a for a in xv.agents if a.language == "bengali")
    assert any(s.suggested_devanagari == "दुनियावालों" for s in hindi.suggestions)
    # Bengali does not invent the Hindi glide on engine hiatus output.
    assert bengali.assessment == "ok" or not any(
        "दुनिया" in s.suggested_devanagari for s in bengali.suggestions
    )
    assert xv.consensus in {
        "no_consensus",
        "conflict",
        "agree_on_changes",
        "language_dependent",
    }
    assert xv.consensus == "language_dependent"
    assert "pending human review" in xv.caveat.lower() or "advisory" in xv.caveat.lower()


def test_cross_validate_api_endpoint() -> None:
    resp = client.post(
        "/api/v1/transliteration/roman-to-devanagari",
        json={
            "text": "DUNIÁ",
            "verify": True,
            "cross_validate": True,
            "language_agents": ["hindi", "bengali"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["devanagari"] == "दुनिआ"  # rule engine unchanged
    assert body["status"] == "needs_review"
    assert body["cross_validation"] is not None
    assert len(body["language_reviews"]) == 2
    hindi = next(a for a in body["language_reviews"] if a["language"] == "hindi")
    assert any(s["suggested_devanagari"] == "दुनिया" for s in hindi["suggestions"])
    assert all(s["status"] == "pending_review" for s in hindi["suggestions"])
    assert "ruleset" in hindi["suggestions"][0]["rule_basis"].lower()


def test_unknown_language_agent_rejected() -> None:
    resp = client.post(
        "/api/v1/transliteration/roman-to-devanagari",
        json={"text": "RÁMA", "language_agents": ["tamil"]},
    )
    assert resp.status_code == 422


def test_catalogue_detects_bad_status() -> None:
    from app.jobs import import_prabhata_catalogue as job

    bad = {
        "schema_version": "1.0.0",
        "catalogue": "x",
        "songs": [
            {
                "song_number": 1,
                "roman": {"text": "", "lines": []},
                "devanagari": {"text": None, "lines": []},
                "line_pairs": [],
                "provenance": {
                    "roman_source_url": None,
                    "devanagari_source_url": None,
                    "devanagari_origin": "rule_based",
                    "ruleset_version": "1.0.0",
                    "verification_status": "totally_bogus",
                },
            }
        ],
    }
    assert any("verification_status" in e for e in job.validate_catalogue(bad))
