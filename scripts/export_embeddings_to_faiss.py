#!/usr/bin/env python3
"""One-time export of pgvector embeddings into a FAISS snapshot.

Reads DATABASE_URL_SOURCE (Azure Postgres with vector columns) and writes
FAISS_INDEX_DIR. Does not print connection strings.

  DATABASE_URL_SOURCE=postgresql://... python scripts/export_embeddings_to_faiss.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.vector import VECTOR_DIMENSION  # noqa: E402
from app.services.faiss_store import get_faiss_store  # noqa: E402


def _parse_vector(value: object) -> np.ndarray:
    if value is None:
        raise ValueError("null vector")
    if isinstance(value, np.ndarray):
        return np.ascontiguousarray(value, dtype=np.float32)
    to_numpy = getattr(value, "to_numpy", None)
    if callable(to_numpy):
        return np.ascontiguousarray(to_numpy(), dtype=np.float32)
    to_list = getattr(value, "to_list", None)
    if callable(to_list):
        return np.ascontiguousarray(to_list(), dtype=np.float32)
    try:
        return np.ascontiguousarray(list(value), dtype=np.float32)
    except TypeError:
        text = str(value).strip()
        if text.startswith("[") and text.endswith("]"):
            text = text[1:-1]
        return np.asarray(
            [float(part) for part in text.split(",") if part.strip()],
            dtype=np.float32,
        )


def _fetch_rows(url: str, sql: str) -> list[tuple[object, ...]]:
    import psycopg
    from pgvector.psycopg import register_vector

    with psycopg.connect(url, connect_timeout=30) as connection:
        register_vector(connection)
        with connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '15min'")
            cursor.execute(sql)
            return list(cursor.fetchall())


def main() -> int:
    source = os.environ.get("DATABASE_URL_SOURCE") or os.environ.get("DATABASE_URL")
    if not source:
        print("Set DATABASE_URL_SOURCE to the Azure Postgres URL (not Neon).", file=sys.stderr)
        return 1
    sqlalchemy_prefix = "postgresql+psycopg://"
    if source.startswith(sqlalchemy_prefix):
        source = "postgresql://" + source[len(sqlalchemy_prefix) :]
    output = Path(os.environ.get("FAISS_INDEX_DIR", ROOT / "data" / "generated" / "faiss"))

    song_rows = _fetch_rows(
        source,
        "SELECT number, embeddings FROM songs WHERE embeddings IS NOT NULL ORDER BY number",
    )
    chunk_rows = _fetch_rows(
        source,
        """
        SELECT id, song_number, embeddings
        FROM song_chunks
        WHERE embeddings IS NOT NULL
        ORDER BY song_number, chunk_index
        """,
    )
    if not song_rows:
        print("No song embeddings found on the source database.", file=sys.stderr)
        return 1

    song_ids = np.asarray([int(row[0]) for row in song_rows], dtype=np.int64)
    song_matrix = np.vstack([_parse_vector(row[1]) for row in song_rows])
    if song_matrix.shape[1] != VECTOR_DIMENSION:
        print(
            f"Unexpected song vector size {song_matrix.shape[1]} (wanted {VECTOR_DIMENSION})",
            file=sys.stderr,
        )
        return 1

    store = get_faiss_store()
    store.songs.replace(song_ids, song_matrix)
    if chunk_rows:
        chunk_ids = np.asarray([int(row[0]) for row in chunk_rows], dtype=np.int64)
        chunk_payload = np.asarray([int(row[1]) for row in chunk_rows], dtype=np.int64)
        chunk_matrix = np.vstack([_parse_vector(row[2]) for row in chunk_rows])
        store.chunks.replace(chunk_ids, chunk_matrix, chunk_payload)
    store.save(output)
    print(f"Wrote FAISS snapshot: {store.songs.ntotal} songs, {store.chunks.ntotal} chunks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
