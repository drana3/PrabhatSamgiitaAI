from typing import Any

from pydantic import BaseModel


class InventoryItemOut(BaseModel):
    source_kind: str
    title: str
    url: str
    status: str
    metadata_json: dict[str, Any]
    notes: str | None = None
