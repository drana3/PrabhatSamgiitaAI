from __future__ import annotations

import re

from app.models import Song

OUTPUT_UNSAFE_PATTERNS = (
    r"<\s*script",
    r"javascript:",
    r"\bon(?:click|error|load)\s*=",
    r"```(?:python|javascript|js|bash|sh|sql)\b",
    r"\b(?:import\s+(?:os|sys|subprocess)|subprocess\.(?:call|run|Popen)|eval\s*\(|exec\s*\()\b",
    r"\b(?:system prompt|developer message|CORRECTIVE GROUNDING PASS)\b",
    r"\bYou are (?:the |a )?(?:professional )?Prabhat Samgiita (?:AI )?(?:Companion|expert)\b",
    r"Retrieved canonical context:",
    r"\bMember interest summary \(may be empty\):\b",
)

OUTPUT_OFF_TOPIC_PATTERNS = (
    r"\bhere(?:'s| is) (?:a |the )?(?:python|javascript|java|c\+\+)(?: program| code| script)?\b",
    r"\b(?:def |class \w+\(|function\s+\w+\s*\([^)]*\)\s*\{)\b",
    r"\b(?:weather forecast|stock price|crypto price|bitcoin price)\b",
)

GUARDED_FALLBACK = (
    "I can only share grounded guidance about this Prabhat Samgiita song — its meaning, "
    "lyrics, imagery, language, or spiritual context. Please ask a specific question about "
    "the song you are exploring."
)


def audit_output_guardrails(answer: str) -> tuple[bool, tuple[str, ...]]:
    issues: list[str] = []
    for pattern in OUTPUT_UNSAFE_PATTERNS:
        if re.search(pattern, answer, re.IGNORECASE):
            issues.append("The response contains unsafe or leaked internal content.")
            break
    for pattern in OUTPUT_OFF_TOPIC_PATTERNS:
        if re.search(pattern, answer, re.IGNORECASE):
            issues.append("The response drifted off-topic or into code generation.")
            break
    return (not issues, tuple(issues))


def apply_output_guardrails(answer: str, song: Song) -> str:
    passed, _issues = audit_output_guardrails(answer)
    if passed:
        return answer
    return (
        f"{GUARDED_FALLBACK}\n\n"
        f"Song {song.number}: «{song.title}»."
    )
