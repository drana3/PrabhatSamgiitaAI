from __future__ import annotations

import asyncio
from dataclasses import dataclass
from time import monotonic


@dataclass(slots=True)
class CacheEntry[T]:
    value: T
    expires_at: float


class AsyncTTLCache[T]:
    def __init__(self, ttl_seconds: int = 300, maxsize: int = 512) -> None:
        self.ttl_seconds = ttl_seconds
        self.maxsize = maxsize
        self._entries: dict[str, CacheEntry[T]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> T | None:
        async with self._lock:
            entry = self._entries.get(key)
            if not entry:
                return None
            if entry.expires_at < monotonic():
                self._entries.pop(key, None)
                return None
            return entry.value

    async def set(self, key: str, value: T) -> None:
        async with self._lock:
            if len(self._entries) >= self.maxsize:
                expired = [
                    cache_key
                    for cache_key, entry in self._entries.items()
                    if entry.expires_at < monotonic()
                ]
                for cache_key in expired:
                    self._entries.pop(cache_key, None)
            if len(self._entries) >= self.maxsize:
                oldest_key = next(iter(self._entries))
                self._entries.pop(oldest_key, None)
            self._entries[key] = CacheEntry(value=value, expires_at=monotonic() + self.ttl_seconds)

    async def clear(self) -> None:
        async with self._lock:
            self._entries.clear()

    def clear_sync(self) -> None:
        """Drop all entries without awaiting — safe for catalog refresh hooks."""
        self._entries.clear()
