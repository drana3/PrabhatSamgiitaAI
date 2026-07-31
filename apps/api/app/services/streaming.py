from __future__ import annotations

from collections.abc import AsyncIterator


async def stream_text(chunks: list[str]) -> AsyncIterator[bytes]:
    for chunk in chunks:
        yield f"data: {chunk}\n\n".encode("utf-8")
