from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol, cast

import httpx

from app.config import Settings


class EmbeddingProvider(Protocol):
    async def embed(self, text: str) -> list[float]: ...

    async def embed_many(self, texts: list[str]) -> list[list[float]]: ...


class TextProvider(Protocol):
    async def complete(self, prompt: str) -> str: ...


class GroundedProvider(EmbeddingProvider, TextProvider, Protocol):
    pass


def extract_responses_text(payload: dict[str, Any]) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct
    parts: list[str] = []
    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict) or block.get("type") != "output_text":
                    continue
                value = block.get("text")
                if isinstance(value, str) and value.strip():
                    parts.append(value)
    if not parts:
        status = payload.get("status")
        incomplete = payload.get("incomplete_details")
        raise ValueError(
            "Azure OpenAI Responses payload did not contain output text "
            f"(status={status!r}, incomplete_details={incomplete!r})"
        )
    return "\n".join(parts)


@dataclass(slots=True)
class MockProvider:
    dimension: int = 16

    async def embed(self, text: str) -> list[float]:
        seed = sum(ord(ch) for ch in text)
        return [((seed + i * 31) % 1000) / 1000 for i in range(self.dimension)]

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(text) for text in texts]

    async def complete(self, prompt: str) -> str:
        if "Return only valid JSON" in prompt:
            fields: dict[str, str] = {}
            for line in prompt.splitlines():
                key, separator, value = line.partition(":")
                if separator and key in {"Title", "First line", "English meaning"}:
                    fields[key] = value.strip()
            return json.dumps(
                {
                    "localized_title": fields.get("Title"),
                    "localized_first_line": fields.get("First line"),
                    "localized_meaning": fields.get("English meaning"),
                    "localized_explanation": fields.get("English meaning"),
                }
            )
        return f"Mock grounded explanation based on: {prompt[:160]}"


@dataclass(slots=True)
class OpenAICompatibleProvider:
    api_key: str
    base_url: str
    model: str

    async def embed(self, text: str) -> list[float]:
        return (await self.embed_many([text]))[0]

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30) as client:
            response = await client.post(
                "/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "input": texts},
            )
            response.raise_for_status()
            payload = cast(dict[str, Any], response.json())
            data = sorted(payload["data"], key=lambda item: item["index"])
            return [cast(list[float], item["embedding"]) for item in data]

    async def complete(self, prompt: str) -> str:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30) as client:
            response = await client.post(
                "/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "max_completion_tokens": 700,
                    "messages": [
                        {"role": "system", "content": "Answer only from provided canonical data."},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            response.raise_for_status()
            payload = cast(dict[str, Any], response.json())
            return cast(str, payload["choices"][0]["message"]["content"])


@dataclass(slots=True)
class AzureOpenAIProvider(OpenAICompatibleProvider):
    embedding_model: str | None = None
    api_version: str = "2024-10-21"
    responses_api_version: str = "2025-04-01-preview"

    async def embed(self, text: str) -> list[float]:
        return (await self.embed_many([text]))[0]

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        deployment = self.embedding_model or self.model
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/openai/deployments/{deployment}/embeddings?api-version={self.api_version}",
                headers={"api-key": self.api_key},
                json={"input": texts},
            )
            response.raise_for_status()
            payload = cast(dict[str, Any], response.json())
            data = sorted(payload["data"], key=lambda item: item["index"])
            return [cast(list[float], item["embedding"]) for item in data]

    async def complete(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/openai/responses?api-version={self.responses_api_version}",
                headers={"api-key": self.api_key},
                json={
                    "model": self.model,
                    "max_output_tokens": 1600,
                    "reasoning": {"effort": "low"},
                    "text": {"verbosity": "low"},
                    "input": [
                        {
                            "role": "system",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": "Answer only from canonical data.",
                                }
                            ],
                        },
                        {
                            "role": "user",
                            "content": [{"type": "input_text", "text": prompt}],
                        },
                    ],
                },
            )
            response.raise_for_status()
            payload = cast(dict[str, Any], response.json())
            return extract_responses_text(payload)


def select_provider(settings: Settings) -> GroundedProvider:
    azure_chat_deployment = (
        settings.azure_openai_chat_deployment or settings.azure_openai_deployment
    )
    azure_embedding_deployment = settings.azure_openai_embedding_deployment or azure_chat_deployment
    if settings.azure_openai_endpoint and settings.azure_openai_api_key and azure_chat_deployment:
        return AzureOpenAIProvider(
            api_key=settings.azure_openai_api_key,
            base_url=str(settings.azure_openai_endpoint).rstrip("/"),
            model=azure_chat_deployment,
            embedding_model=azure_embedding_deployment,
            api_version=settings.azure_openai_api_version,
            responses_api_version=settings.azure_openai_responses_api_version,
        )
    if settings.openai_api_key:
        return OpenAICompatibleProvider(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.openai_model,
        )
    return MockProvider()
