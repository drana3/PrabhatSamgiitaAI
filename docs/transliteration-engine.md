# Roman Saṃskṛta → Devanagari transliteration engine

A deterministic, rule-based engine that converts Prabhát Saṃgiita Roman
Saṃskṛta lyrics into Devanagari, with an **independent** verification layer and
a resumable catalogue pipeline.

- Ruleset version: `1.0.0`
- Engine version: `1.0.0`

> Accuracy and transparency are prioritised over coverage. Where the Roman
> spelling cannot uniquely determine the Devanagari form, the engine **flags the
> ambiguity** (`needs_review`) instead of silently guessing.

## 1. Authoritative sources

- Official Roman Saṃskṛta alphabet (P.R. Sarkar):
  <https://www.prabhatasamgiita.net/romansamskrta.html>
- Song catalogue index: <https://prabhatasamgiita.net/1-5018.htm>
- Resources: <https://prabhatasamgiita.net/resources.html>

The full 5018-song Roman corpus is **already present locally** in
`data/generated/songs.json` (extracted and marked `is_verified`). The pipeline
therefore reads the local authoritative dataset rather than re-scraping the
site — this respects the site's terms, avoids fabricating data, and keeps
provenance honest. The extraction step is isolated in `extract_songs()` so a
future polite, bounded HTTP source could be added behind the same interface.

## 2. Mapping specification

The machine-readable mapping lives in
`apps/api/app/services/transliteration/mapping.py` and is rendered to
`docs/transliteration-mapping-audit.md` / `.json` by:

```
python -m app.services.transliteration.audit
```

### Conventions the corpus actually uses

The catalogue writes diacritics two ways, both supported and treated as exactly
equivalent:

| Phoneme | Accent form (corpus) | Apostrophe form (URLs/booklet) | Devanagari |
| --- | --- | --- | --- |
| ā | `Á` | `a'` | आ / ा |
| ū | `Ú` | `u'` | ऊ / ू |
| ī | `II` (digraph) | `ii` | ई / ी |
| retroflex ṭ | `T́` (T + U+0301) | `t'` | ट |
| retroflex ḍ | `D́` (D + U+0301) | `d'` | ड |
| retroflex ṇ | `Ń` | `n'` | ण |
| retroflex sibilant ṣ | `Ś` | `s'` | ष |
| retroflex flap | `Ŕ`, `ŔH` | `r'`, `r'h` | ड़, ढ़ |
| anusvāra | `Ḿ` | `m'` | ं |

Sibilant distinction is preserved: **`SH` → श** (palatal), **`Ś` → ष**
(retroflex), **`S` → स** (dental). Aspirates are `H`-digraphs (`KH GH CH JH TH
DH PH BH`). Conjuncts (e.g. `LAKŚMII` → लक्ष्मी) and word-final halanta (e.g.
`UPAL` → उपल्) follow standard Brahmic orthography.

### Documented limitations / ambiguities (flagged, never guessed)

- **Vocalic ṛ**: a bare `R` between consonants (e.g. `HRDAYE`) may be the vowel
  ऋ; rendered as the consonant र and flagged `needs_review`.
- **Diphthongs `AE` / `AO`**: mapped to ऐ / औ per spec, but flagged because a
  long `Á`+vowel sequence is not a diphthong.
- **Foreign consonants `F Z Q`**: not part of Saṃskṛta; rendered with nukta
  (फ़ ज़ क़) and flagged.

## 3. APIs

- `POST /api/v1/transliteration/roman-to-devanagari`
- `POST /api/v1/transliteration/roman-to-devanagari/batch`

Both share the same engine. The batch endpoint preserves input order/IDs,
isolates per-item failures, returns summary counts, and never invokes an LLM.
`verification.confidence` is **always `null`** (no calibrated metric exists).

Example:

```json
POST /api/v1/transliteration/roman-to-devanagari
{ "text": "PRABHÁTA SAḾGIITA", "verify": true }

{
  "original_roman": "PRABHÁTA SAḾGIITA",
  "devanagari": "प्रभात संगीत",
  "status": "rules_passed",
  "method": "rule_based",
  "ruleset_version": "1.0.0",
  "engine_version": "1.0.0",
  "verification": { "status": "rules_passed", "confidence": null, "issues": [] }
}
```

## 4. Verification

`verification.py` is an independent module. It re-runs the engine (determinism
check), confirms every input token is recognised, preserves line counts, checks
Devanagari combining-mark validity, confirms long-vowel preservation, and — when
an authoritative Devanagari reference is supplied — can return
`reference_matched`. Statuses: `rules_passed`, `reference_matched`,
`needs_review`, `unsupported_input`, `manually_verified`.

Verification hierarchy (highest priority first): authoritative Devanagari for
the exact song → official rules → verified song-specific conventions →
deterministic algorithmic validation → optional AI review → human review.

## 4.1 Language review agents (on top of the rules)

Agents never replace the engine. Order is always:

1. Rule-based `transliterate()` → candidate Devanagari
2. Language agent(s) review that candidate
3. Suggestions stay `pending_review` (never auto-applied)

| Agent | Extra orthography on top of ruleset |
| --- | --- |
| `hindi` / `urdu` | य/व glide (`DUNIÁ` → दुनिया); `VÁNLO` → वालों (`DUNIÁVÁNLO` → दुनियावालों); vocalic ṛ flag |
| `bengali` | Keep hiatus (`JÁI` → जाइ); reject unlicensed य-glide |
| `samskrta` | Prefer ऋ/ृ for C+R+C (`KRŚŃA` → suggest कृष्ण); keep hiatus |

Cross-validation (`cross_validate: true`) runs multiple agents and reports:

- `all_ok` — no agent suggested changes
- `agree_on_changes` — agents agree on the same suggestion
- `language_dependent` — e.g. Hindi wants दुनिया, Bengali keeps दुनिआ
- `conflict` — agents propose different Devanagari for the same Roman target

Example request:

```json
{
  "text": "DUNIÁVÁNLO, TÁKATE RAHO",
  "verify": true,
  "cross_validate": true,
  "language_agents": ["hindi", "bengali", "urdu", "samskrta"],
  "language_agents_use_llm": false
}
```

Optional `language_agents_use_llm: true` enriches each agent with a
ruleset-grounded LLM pass (still advisory, still never auto-applied).

## 5. Catalogue pipeline

```
python -m app.jobs.import_prabhata_catalogue --dry-run
python -m app.jobs.import_prabhata_catalogue --export-json
python -m app.jobs.import_prabhata_catalogue --resume
python -m app.jobs.import_prabhata_catalogue --validate-export
python -m app.jobs.import_prabhata_catalogue --report
```

Outputs (in `data/generated/`):

- `transliteration_catalogue.json` — canonical export (validated against
  `data/schemas/transliteration_catalogue.schema.json`).
- `transliteration_catalogue.state.json` — resume state (per-song source hash).
- `transliteration_catalogue.report.json` — quality report.

The job is **idempotent** (keyed by `song_number`), **resumable** (skips songs
whose Roman source hash is unchanged), and **never overwrites** records whose
provenance is `manually_verified` / `reference_matched` or that carry a
`verified_by`.

## 6. Latest run (2026-10-17)

| Metric | Value |
| --- | --- |
| Songs extracted | 5018 |
| Missing / duplicate song IDs | 0 / 0 |
| Songs with authoritative Devanagari | 0 (none published alongside corpus) |
| Songs provisional (rule_based) | 5018 |
| Song status `rules_passed` | 3538 |
| Song status `needs_review` | 1480 |
| Song status `unsupported_input` | 0 |
| Lines `rules_passed` | 97729 (97.26%) |
| Lines `needs_review` | 2749 |

`needs_review` is driven by the documented ambiguities (`AE`/`AO` diphthongs,
vocalic `R`, foreign `F/Z/Q`) — not by unrecognised input.

### Measured accuracy caveat

No reference-backed character/word error rate is reported because **no
authoritative Devanagari corpus is available** to score against. Reporting a
number without a gold reference would be dishonest. The unit tests use
hand-derived gold pairs (not engine output) for the covered constructs; a
reference-backed CER/WER can be computed once authoritative Devanagari lyrics
are provided.

## 7. Tests

```
cd apps/api && .venv/bin/python -m pytest tests/test_transliteration.py -q
```

47 tests cover every mapping token, case-insensitivity, Unicode NFC/NFD
equivalence, longest-match, vowel length, retroflex/dental, sibilants,
conjuncts, halanta, refrain/line preservation, unsupported/ambiguous flagging,
the APIs (incl. size limits and batch isolation), and the catalogue job
(record building, preservation of protected records, schema validation).
