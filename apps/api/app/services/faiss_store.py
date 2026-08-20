from __future__ import annotations

import io
import json
import logging
import zipfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import numpy as np

from app.core.vector import VECTOR_DIMENSION

logger = logging.getLogger(__name__)

SONGS_MATRIX = "songs.f32"
SONGS_IDS = "songs.ids.npy"
CHUNKS_MATRIX = "chunks.f32"
CHUNKS_IDS = "chunks.ids.npy"
CHUNKS_SONG_NUMBERS = "chunks.song_numbers.npy"
META = "meta.json"


def _faiss_module() -> Any:
    import faiss

    return faiss


def l2_normalize(matrix: np.ndarray) -> np.ndarray:
    matrix = np.ascontiguousarray(matrix, dtype=np.float32)
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    np.maximum(norms, 1e-12, out=norms)
    return np.asarray(matrix / norms, dtype=np.float32)


class VectorTable:
    """In-memory FAISS IndexFlatIP over L2-normalized vectors (cosine)."""

    def __init__(self) -> None:
        self.ids = np.empty((0,), dtype=np.int64)
        self.payload = np.empty((0,), dtype=np.int64)
        self.matrix = np.empty((0, VECTOR_DIMENSION), dtype=np.float32)
        self._index: Any | None = None
        self._id_to_row: dict[int, int] = {}

    @property
    def ntotal(self) -> int:
        return int(self.ids.shape[0])

    def id_set(self) -> set[int]:
        return set(self._id_to_row.keys())

    def _rebuild_index(self) -> None:
        self._id_to_row = {int(item_id): row for row, item_id in enumerate(self.ids.tolist())}
        if self.ntotal == 0:
            self._index = None
            return
        try:
            faiss = _faiss_module()
        except ImportError:
            logger.warning("faiss is not installed; using NumPy inner-product search")
            self._index = None
            return
        index = faiss.IndexFlatIP(VECTOR_DIMENSION)
        index.add(np.ascontiguousarray(self.matrix, dtype=np.float32))
        self._index = index

    def replace(
        self,
        ids: np.ndarray,
        matrix: np.ndarray,
        payload: np.ndarray | None = None,
    ) -> None:
        ids = np.ascontiguousarray(ids, dtype=np.int64).reshape(-1)
        matrix = l2_normalize(matrix)
        if matrix.shape[0] != ids.shape[0]:
            raise ValueError("ids and matrix length mismatch")
        if matrix.shape[1] != VECTOR_DIMENSION:
            raise ValueError(f"expected dimension {VECTOR_DIMENSION}, got {matrix.shape[1]}")
        self.ids = ids
        self.matrix = matrix
        self.payload = (
            np.ascontiguousarray(payload, dtype=np.int64).reshape(-1)
            if payload is not None
            else ids.copy()
        )
        self._rebuild_index()

    def upsert(
        self,
        ids: np.ndarray,
        matrix: np.ndarray,
        payload: np.ndarray | None = None,
    ) -> None:
        ids = np.ascontiguousarray(ids, dtype=np.int64).reshape(-1)
        matrix = l2_normalize(matrix)
        payload = (
            np.ascontiguousarray(payload, dtype=np.int64).reshape(-1)
            if payload is not None
            else ids.copy()
        )
        if self.ntotal == 0:
            self.replace(ids, matrix, payload)
            return
        keep = [
            row
            for row, item_id in enumerate(self.ids.tolist())
            if int(item_id) not in set(ids.tolist())
        ]
        if keep:
            merged_ids = np.concatenate([self.ids[keep], ids])
            merged_matrix = np.vstack([self.matrix[keep], matrix])
            merged_payload = np.concatenate([self.payload[keep], payload])
        else:
            merged_ids, merged_matrix, merged_payload = ids, matrix, payload
        self.replace(merged_ids, merged_matrix, merged_payload)

    def search(self, query: list[float], limit: int) -> list[tuple[int, float, int]]:
        if self.ntotal == 0 or limit <= 0 or not query:
            return []
        query_vec = l2_normalize(np.asarray(query, dtype=np.float32))
        if query_vec.shape[1] != VECTOR_DIMENSION:
            return []
        k = min(limit, self.ntotal)
        if self._index is not None:
            scores, rows = self._index.search(query_vec, k)
            hits: list[tuple[int, float, int]] = []
            for score, row in zip(scores[0], rows[0], strict=True):
                if row < 0:
                    continue
                hits.append((int(self.ids[row]), float(score), int(self.payload[row])))
            return hits
        dots = self.matrix @ query_vec.reshape(-1)
        order = np.argpartition(-dots, kth=k - 1)[:k]
        order = order[np.argsort(-dots[order])]
        return [
            (int(self.ids[row]), float(dots[row]), int(self.payload[row])) for row in order.tolist()
        ]


class FaissStore:
    def __init__(self) -> None:
        self.songs = VectorTable()
        self.chunks = VectorTable()
        self.directory: Path | None = None

    def ready(self) -> bool:
        return self.songs.ntotal > 0

    def stats(self) -> dict[str, int | bool]:
        return {
            "songs": self.songs.ntotal,
            "chunks": self.chunks.ntotal,
            "loaded": self.ready(),
        }

    def load(self, directory: str | Path) -> bool:
        path = Path(directory)
        songs_matrix = path / SONGS_MATRIX
        if not songs_matrix.exists():
            return False
        self.songs.replace(
            np.load(path / SONGS_IDS),
            np.fromfile(songs_matrix, dtype=np.float32).reshape(-1, VECTOR_DIMENSION),
        )
        chunks_matrix = path / CHUNKS_MATRIX
        if chunks_matrix.exists() and (path / CHUNKS_IDS).exists():
            payload_path = path / CHUNKS_SONG_NUMBERS
            payload = np.load(payload_path) if payload_path.exists() else None
            self.chunks.replace(
                np.load(path / CHUNKS_IDS),
                np.fromfile(chunks_matrix, dtype=np.float32).reshape(-1, VECTOR_DIMENSION),
                payload,
            )
        self.directory = path
        logger.info(
            "Loaded FAISS snapshot (%s songs, %s chunks) from %s",
            self.songs.ntotal,
            self.chunks.ntotal,
            path,
        )
        return True

    def save(self, directory: str | Path | None = None) -> Path:
        path = Path(directory or self.directory or "./data/generated/faiss")
        path.mkdir(parents=True, exist_ok=True)
        np.save(path / SONGS_IDS, self.songs.ids)
        self.songs.matrix.astype(np.float32, copy=False).tofile(path / SONGS_MATRIX)
        np.save(path / CHUNKS_IDS, self.chunks.ids)
        np.save(path / CHUNKS_SONG_NUMBERS, self.chunks.payload)
        self.chunks.matrix.astype(np.float32, copy=False).tofile(path / CHUNKS_MATRIX)
        (path / META).write_text(
            json.dumps(
                {
                    "dimension": VECTOR_DIMENSION,
                    "metric": "cosine_ip",
                    "index": "IndexFlatIP",
                    "songs": self.songs.ntotal,
                    "chunks": self.chunks.ntotal,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        self.directory = path
        return path

    def search_songs(self, query: list[float], limit: int) -> list[tuple[int, float]]:
        return [(item_id, score) for item_id, score, _ in self.songs.search(query, limit)]

    def search_chunks(self, query: list[float], limit: int) -> list[tuple[int, float, int]]:
        return self.chunks.search(query, limit)


_STORE = FaissStore()


def get_faiss_store() -> FaissStore:
    return _STORE


def reset_faiss_store() -> FaissStore:
    global _STORE
    _STORE = FaissStore()
    return _STORE


def download_faiss_snapshot(url: str, directory: str | Path) -> None:
    import httpx

    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("FAISS_INDEX_URL must be http(s)")
    allowed = {
        SONGS_MATRIX,
        SONGS_IDS,
        CHUNKS_MATRIX,
        CHUNKS_IDS,
        CHUNKS_SONG_NUMBERS,
        META,
    }
    logger.info("Downloading FAISS snapshot")
    with httpx.Client(timeout=300.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        blob = io.BytesIO(response.content)
    with zipfile.ZipFile(blob) as archive:
        for item in archive.infolist():
            if item.is_dir():
                continue
            name = Path(item.filename).name
            if name not in allowed:
                continue
            target = path / name
            with archive.open(item) as src, target.open("wb") as dest:
                dest.write(src.read())
