#!/usr/bin/env python3
"""Build UI + API language catalogs from Google Translate v2 /languages JSON.

Usage:
  curl -sS "https://translation.googleapis.com/language/translate/v2/languages?key=$KEY&target=en" \\
    -o /tmp/gt_langs.json
  python3 scripts/sync_google_translate_languages.py /tmp/gt_langs.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Indic / South Asian group for the Meaning switcher.
INDIAN = {
    "as",
    "awa",
    "bn",
    "bho",
    "doi",
    "dv",
    "dz",
    "gom",
    "gu",
    "hi",
    "kn",
    "mai",
    "mag",
    "ml",
    "mni-Mtei",
    "mr",
    "ne",
    "new",
    "or",
    "pa",
    "pa-Arab",
    "sa",
    "sd",
    "si",
    "ta",
    "te",
    "ur",
}

# Curated native labels; others fall back to the English Google name.
NATIVE = {
    "en": "English",
    "hi": "हिन्दी",
    "bn": "বাংলা",
    "ta": "தமிழ்",
    "ur": "اردو",
    "mai": "मैथिली",
    "mag": "मगही",
    "as": "অসমীয়া",
    "gu": "ગુજરાતી",
    "kn": "ಕನ್ನಡ",
    "ml": "മലയാളം",
    "mr": "मराठी",
    "ne": "नेपाली",
    "or": "ଓଡ଼ିଆ",
    "pa": "ਪੰਜਾਬੀ",
    "sa": "संस्कृतम्",
    "te": "తెలుగు",
    "ar": "العربية",
    "zh-CN": "中文",
    "zh-TW": "中文（繁體）",
    "nl": "Nederlands",
    "fr": "Français",
    "fr-CA": "Français (Canada)",
    "de": "Deutsch",
    "id": "Bahasa Indonesia",
    "it": "Italiano",
    "ja": "日本語",
    "ko": "한국어",
    "fa": "فارسی",
    "pl": "Polski",
    "pt": "Português",
    "pt-PT": "Português (Portugal)",
    "ru": "Русский",
    "si": "සිංහල",
    "es": "Español",
    "sw": "Kiswahili",
    "th": "ไทย",
    "tr": "Türkçe",
    "vi": "Tiếng Việt",
    "he": "עברית",
    "el": "Ελληνικά",
    "uk": "Українська",
    "sv": "Svenska",
    "ro": "Română",
    "cs": "Čeština",
    "hu": "Magyar",
    "fi": "Suomi",
    "da": "Dansk",
    "no": "Norsk",
    "sk": "Slovenčina",
    "hr": "Hrvatski",
    "sr": "Српски",
    "bg": "Български",
    "ms": "Bahasa Melayu",
    "tl": "Filipino",
    "km": "ខ្មែរ",
    "lo": "ລາວ",
    "my": "မြန်မာ",
    "ka": "ქართული",
    "hy": "Հայերեն",
    "am": "አማርኛ",
    "yo": "Yorùbá",
    "zu": "isiZulu",
    "xh": "isiXhosa",
    "af": "Afrikaans",
    "sq": "Shqip",
    "eu": "Euskara",
    "be": "Беларуская",
    "bs": "Bosanski",
    "ca": "Català",
    "cy": "Cymraeg",
    "et": "Eesti",
    "ga": "Gaeilge",
    "gl": "Galego",
    "is": "Íslenska",
    "lt": "Lietuvių",
    "lv": "Latviešu",
    "mk": "Македонски",
    "mt": "Malti",
    "sl": "Slovenščina",
    "bho": "भोजपुरी",
    "doi": "डोगरी",
    "sd": "سنڌي",
    "gom": "कोंकणी",
    "awa": "अवधी",
    "mni-Mtei": "ꯃꯤꯇꯩꯂꯣꯟ",
    "new": "नेपाल भाषा",
}

LABEL_OVERRIDES = {
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    "pt": "Portuguese",
    "or": "Odia",
}

ALIASES = {
    "zh": "zh-CN",
    "zh-hans": "zh-CN",
    "zh-hant": "zh-TW",
    "iw": "he",
    "jw": "jv",
    "fil": "tl",
    "nb": "no",
}

SKIP_CODES = {"iw", "jw", "zh"}


def ts_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def build_options(prefer: dict[str, str]) -> list[dict[str, str]]:
    options: list[dict[str, str]] = []
    for code, name in prefer.items():
        label = LABEL_OVERRIDES.get(code, name)
        group = "Indian languages" if code in INDIAN else "World languages"
        options.append(
            {
                "code": code,
                "label": label,
                "nativeLabel": NATIVE.get(code, label),
                "group": group,
            }
        )
    options.append(
        {
            "code": "mag",
            "label": "Magahi",
            "nativeLabel": "मगही",
            "group": "Indian languages",
        }
    )
    indian = sorted(
        [row for row in options if row["group"] == "Indian languages"],
        key=lambda row: row["label"].lower(),
    )
    world = sorted(
        [row for row in options if row["group"] == "World languages"],
        key=lambda row: (0 if row["code"] == "en" else 1, row["label"].lower()),
    )
    return indian + world


def write_ts(path: Path, options: list[dict[str, str]], headers: list[str], footers: list[str]) -> None:
    lines = [
        "export type LocaleOption = {",
        "  code: string",
        "  label: string",
        "  nativeLabel: string",
        '  group: "Indian languages" | "World languages"',
        "}",
        "",
        *headers,
        "export const localeOptions: LocaleOption[] = [",
    ]
    for row in options:
        lines.append(
            "  { "
            f'code: "{row["code"]}", '
            f'label: "{ts_escape(row["label"])}", '
            f'nativeLabel: "{ts_escape(row["nativeLabel"])}", '
            f'group: "{row["group"]}" '
            "},"
        )
    lines.append("]")
    lines.extend(footers)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def replace_block(path: Path, start_marker: str, end_marker: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")


def main() -> int:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/gt_langs.json")
    payload = json.loads(src.read_text(encoding="utf-8"))
    prefer: dict[str, str] = {}
    for item in payload["data"]["languages"]:
        code = item["language"]
        if code in SKIP_CODES:
            continue
        prefer[code] = item["name"]

    options = build_options(prefer)
    google_codes = sorted(prefer.keys(), key=lambda code: code.casefold())

    write_ts(
        ROOT / "apps/web/lib/languages.ts",
        options,
        ["/** Full Google Cloud Translation (Basic v2) target list + Magahi (LLM fallback). */"],
        [
            "",
            "export function localeLabel(code: string) {",
            "  return localeOptions.find((option) => option.code === code)?.label ?? code",
            "}",
            "",
        ],
    )
    write_ts(
        ROOT / "apps/mobile/constants/languages.ts",
        options,
        [
            "/** Aligned with the website language switcher (API expects English labels). */",
            "/** Full Google Cloud Translation (Basic v2) target list + Magahi (LLM fallback). */",
        ],
        [
            "",
            'export const quickLocaleCodes = ["en", "hi", "bn", "ta", "fr", "es"] as const',
            "",
            "export function localeNativeLabel(code: string) {",
            "  return localeOptions.find((option) => option.code === code)?.nativeLabel ?? code",
            "}",
            "",
            "export function localeLabel(code: string) {",
            "  return localeOptions.find((option) => option.code === code)?.label ?? code",
            "}",
            "",
        ],
    )

    py_google = [
        '"""Canonical Google Cloud Translation v2 language codes (Basic / NMT)."""',
        "",
        "from __future__ import annotations",
        "",
        "# From translate/v2/languages (deduped: drop iw/jw/zh in favor of he/jv/zh-CN).",
        "GOOGLE_LANGUAGE_CODES: frozenset[str] = frozenset({",
    ]
    for code in google_codes:
        py_google.append(f'    "{code}",')
    py_google.append("})")
    py_google.append("")
    py_google.append("GOOGLE_CODE_ALIASES: dict[str, str] = {")
    for key, value in sorted(ALIASES.items()):
        py_google.append(f'    "{key}": "{value}",')
    py_google.extend(
        [
            "}",
            "",
            "_GOOGLE_BY_FOLD: dict[str, str] = {code.casefold(): code for code in GOOGLE_LANGUAGE_CODES}",
            "for _alias, _target in GOOGLE_CODE_ALIASES.items():",
            "    _GOOGLE_BY_FOLD.setdefault(",
            "        _alias.casefold(),",
            "        _GOOGLE_BY_FOLD.get(_target.casefold(), _target),",
            "    )",
            "",
            "",
            "def google_target_code(language_code: str) -> str | None:",
            '    """Map a UI/API language token to a Google Translate target code."""',
            "    token = language_code.strip()",
            "    if not token:",
            "        return None",
            "    return _GOOGLE_BY_FOLD.get(token.casefold())",
            "",
        ]
    )
    (ROOT / "apps/api/app/services/google_translate_languages.py").write_text(
        "\n".join(py_google) + "\n",
        encoding="utf-8",
    )

    labels = {row["code"]: row["label"] for row in options}
    labels.setdefault("zh", "Chinese")
    py_labels = ["LANGUAGE_LABELS: dict[str, str] = {\n"]
    for code, label in sorted(labels.items(), key=lambda item: item[0].casefold()):
        safe = label.replace("\\", "\\\\").replace('"', '\\"')
        py_labels.append(f'    "{code}": "{safe}",\n')
    py_labels.append("}\n\n")
    replace_block(
        ROOT / "apps/api/app/services/song_meanings.py",
        "LANGUAGE_LABELS: dict[str, str] = {",
        "_LABEL_TO_CODE",
        "".join(py_labels),
    )

    supp = ["SUPPORTED_LANGUAGES = {\n"]
    for code in sorted(labels.keys(), key=lambda value: value.casefold()):
        supp.append(f'    "{code}",\n')
    supp.append("}\n\n")
    replace_block(
        ROOT / "apps/api/app/services/ingestion_language.py",
        "SUPPORTED_LANGUAGES = {",
        "SCRIPT_PATTERNS",
        "".join(supp),
    )

    codes = [row["code"] for row in options]
    assert len(codes) == len(set(codes)), "duplicate locale codes"
    folds = [row["label"].casefold() for row in options]
    assert len(folds) == len(set(folds)), "duplicate locale labels"
    print(f"Wrote {len(options)} locales ({sum(1 for row in options if row['group']=='Indian languages')} Indian, "
          f"{sum(1 for row in options if row['group']=='World languages')} world); "
          f"{len(google_codes)} Google codes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
