from __future__ import annotations

import re


def try_conversation_answer(
    query: str,
    history: list[tuple[str, str]],
) -> str | None:
    cleaned = " ".join(query.casefold().split())
    user_turns = [content for role, content in history if role == "user"]
    assistant_turns = [content for role, content in history if role == "assistant"]

    asks_for_last_question = (
        (
            ("last" in cleaned or "previous" in cleaned or "pichhla" in cleaned or "pichle" in cleaned)
            and ("ask" in cleaned or "question" in cleaned or "prashn" in cleaned or "pucha" in cleaned)
            and (re.search(r"\b(?:i|my|me|maine|mera|mujhe)\b", cleaned) is not None)
        )
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
