from __future__ import annotations


def feedback_is_priority(category: str, rating: int) -> bool:
    return rating <= 2 or category in {"ai", "content", "accessibility"}


def feedback_acknowledgement(feedback_id: str, *, priority: bool) -> str:
    reference = feedback_id.split("-", 1)[0]
    if priority:
        return (
            f"Thank you — your feedback was received (ref {reference}). "
            "We prioritise AI and content issues and will review this soon."
        )
    return (
        f"Thank you — your feedback was received (ref {reference}). "
        "Our team reviews every submission."
    )
