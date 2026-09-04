from __future__ import annotations

import re

from app.services.chat_language import (
    established_language_from_history,
    explicit_response_language,
    explicit_target_language_label,
    is_language_rephrase,
    language_switch_acknowledgment,
)


def try_conversation_answer(
    query: str,
    history: list[tuple[str, str]],
) -> str | None:
    cleaned = " ".join(query.casefold().split())
    user_turns = [content for role, content in history if role == "user"]
    assistant_turns = [content for role, content in history if role == "assistant"]

    mentions_last = (
        "last" in cleaned
        or "previous" in cleaned
        or "pichhla" in cleaned
        or "pichle" in cleaned
    )
    mentions_question = (
        "ask" in cleaned
        or "question" in cleaned
        or "prashn" in cleaned
        or "pucha" in cleaned
    )
    asks_for_last_question = (
        mentions_last
        and mentions_question
        and re.search(r"\b(?:i|my|me|maine|mera|mujhe)\b", cleaned) is not None
    )
    if asks_for_last_question:
        if not user_turns:
            return "There is no earlier question in this conversation yet."
        return f"Your previous question was: “{user_turns[-1]}”"

    asks_for_last_answer = (
        ("last" in cleaned or "previous" in cleaned or "pichla" in cleaned or "pichle" in cleaned)
        and (
            "you say" in cleaned
            or "your answer" in cleaned
            or "you replied" in cleaned
            or "tumne kaha" in cleaned
            or "aapne kaha" in cleaned
        )
    )
    if asks_for_last_answer:
        if not assistant_turns:
            return "There is no earlier answer in this conversation yet."
        return f"My previous answer was: “{assistant_turns[-1]}”"

    asks_for_summary = (
        any(term in cleaned for term in ("summarize", "summarise", "recap", "saar", "summary"))
        and any(
            term in cleaned
            for term in ("conversation", "chat", "discussion", "we discussed", "baat", "discuss")
        )
    )
    if asks_for_summary:
        if not user_turns:
            return "There are no earlier questions to summarize yet."
        recent = user_turns[-4:]
        questions = "\n".join(f"{index}. {content}" for index, content in enumerate(recent, 1))
        return f"Here are your recent questions:\n{questions}"

    return None


def try_language_switch_acknowledgment(
    query: str,
    history: list[tuple[str, str]],
) -> str | None:
    cleaned = query.strip()
    if not is_language_rephrase(cleaned):
        return None
    target = explicit_response_language(cleaned)
    if not target:
        return None
    prior = established_language_from_history(history)
    label = explicit_target_language_label(cleaned) if target == "other" else None
    return language_switch_acknowledgment(prior, target, target_label=label)
