from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx


class EmbeddingProvider(Protocol):
    async def embed(self, text: str) -> list[float]: ...


class TextProvider(Protocol):
    async def complete(self, prompt: str) -> str: ...


@dataclass(slots=True)
class MockProvider:
    dimension: int = 16

    async def embed(self, text: str) -> list[float]:
        seed = sum(ord(ch) for ch in text)
        return [((seed + i * 31) % 1000) / 1000 for i in range(self.dimension)]

    async def complete(self, prompt: str) -> str:
        return f"Mock grounded explanation based on: {prompt[:160]}"


@dataclass(slots=True)
class OpenAICompatibleProvider:
    api_key: str
    base_url: str
    model: str

    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30) as client:
            response = await client.post(
                "/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "input": text},
            )
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]

    async def complete(self, prompt: str) -> str:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30) as client:
            response = await client.post(
                "/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "Answer only from provided canonical data."},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]


@dataclass(slots=True)
class AzureOpenAIProvider(OpenAICompatibleProvider):
    api_version: str = "2024-10-21"

    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/openai/deployments/{self.model}/embeddings?api-version={self.api_version}",
                headers={"api-key": self.api_key},
                json={"input": text},
            )
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]

    async def complete(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/openai/deployments/{self.model}/chat/completions?api-version={self.api_version}",
                headers={"api-key": self.api_key},
                json={
                    "messages": [
                        {"role": "system", "content": "Answer only from canonical data."},
                        {"role": "user", "content": prompt},
                    ]
                },
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]


def select_provider(settings) -> EmbeddingProvider | TextProvider:
    if (
        settings.azure_openai_endpoint
        and settings.azure_openai_api_key
        and settings.azure_openai_deployment
    ):
        return AzureOpenAIProvider(
            api_key=settings.azure_openai_api_key,
            base_url=str(settings.azure_openai_endpoint).rstrip("/"),
            model=settings.azure_openai_deployment,
            api_version=settings.azure_openai_api_version,
        )
    if settings.openai_api_key:
        return OpenAICompatibleProvider(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.openai_model,
        )
    return MockProvider()
