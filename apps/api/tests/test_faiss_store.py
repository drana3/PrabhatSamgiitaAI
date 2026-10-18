from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.core.vector import VECTOR_DIMENSION
from app.services.faiss_store import reset_faiss_store
from app.services.search import HybridSearchService
from tests.test_full_catalog import UnavailableSession


def test_faiss_search_returns_nearest_song(tmp_path: Path) -> None:
    store = reset_faiss_store()
    rng = np.random.default_rng(0)
    matrix = rng.normal(size=(32, VECTOR_DIMENSION)).astype(np.float32)
    ids = np.arange(1, 33, dtype=np.int64)
    store.songs.replace(ids, matrix)
    query = matrix[7].tolist()
    hits = store.search_songs(query, limit=3)
    assert hits[0][0] == 8
    assert hits[0][1] > 0.99

    store.save(tmp_path)
    reloaded = reset_faiss_store()
    assert reloaded.load(tmp_path)
    assert reloaded.search_songs(query, limit=1)[0][0] == 8


def test_chunk_search_maps_song_numbers() -> None:
    store = reset_faiss_store()
    matrix = np.eye(VECTOR_DIMENSION, dtype=np.float32)[:4]
    store.chunks.replace(
        np.asarray([10, 11, 12, 13], dtype=np.int64),
        matrix,
        np.asarray([100, 200, 100, 300], dtype=np.int64),
    )
    query = matrix[1].tolist()
    chunk_id, score, song_number = store.search_chunks(query, limit=1)[0]
    assert chunk_id == 11
    assert song_number == 200
    assert score > 0.99


@pytest.mark.asyncio
async def test_hybrid_search_ranks_from_faiss_without_postgres() -> None:
    store = reset_faiss_store()
    matrix = np.eye(VECTOR_DIMENSION, dtype=np.float32)[:4]
    store.songs.replace(np.asarray([111, 222, 333, 444], dtype=np.int64), matrix)
    store.chunks.replace(
        np.asarray([10, 11, 12, 13], dtype=np.int64),
        matrix,
        np.asarray([111, 222, 111, 444], dtype=np.int64),
    )
    service = HybridSearchService(UnavailableSession())  # type: ignore[arg-type]
    assert await service._has_vector_index()
    query = matrix[1].tolist()
    assert await service._vector_rank([], query, limit=1) == ["222"]
    assert await service._rag_chunk_rank("feeling", query, [], limit=1) == ["222"]
