import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
for path in (ROOT, REPOSITORY_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))


@pytest.fixture(autouse=True)
def reset_in_memory_faiss_store() -> None:
    from app.services.faiss_store import reset_faiss_store

    reset_faiss_store()
    yield
    reset_faiss_store()
