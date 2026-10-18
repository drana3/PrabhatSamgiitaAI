from __future__ import annotations

import re

SAFE_REDIRECT = (
    "I can help with Prabhat Samgiita songs, meanings, and spiritual themes. "
    "Please ask about a song or a related spiritual question."
)

# Phrases that suggest prompt leakage or credential exposure (OWASP LLM01/LLM02/LLM07).
_LEAK_PATTERNS = (
    r"\bsystem\s+prompt\b",
    r"\bignore\s+(?:all\s+)?previous\s+instructions\b",
    r"\byou\s+are\s+(?:the\s+|a\s+)?(?:professional\s+)?prabhat\s+samgiita\s+(?:ai\s+)?(?:companion|expert)\b",
    r"\bretrieved\s+canonical\s+context\b",
    r"\bmember\s+interest\s+summary\s+\(may\s+be\s+empty\)\b",
    r"\b(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S+",
    r"\bsk-[a-zA-Z0-9]{20,}\b",
    r"\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b",
    r"\b(?:DATABASE_URL|MEMBER_PROXY_KEY|AZURE_OPENAI_API_KEY)\b",
    r"postgresql(?:\+psycopg)?://\S+",
)


def sanitize_model_output(answer: str | None) -> str:
    """Replace unsafe model output with a safe redirect instead of streaming secrets."""
    text = (answer or "").strip()
    if not text:
        return SAFE_REDIRECT
    if any(re.search(pattern, text, re.IGNORECASE) for pattern in _LEAK_PATTERNS):
        return SAFE_REDIRECT
    return text
