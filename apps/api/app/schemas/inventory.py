from pydantic import BaseModel


class InventoryItemOut(BaseModel):
    source_kind: str
    title: str
    url: str
    status: str
    metadata_json: dict
    notes: str | None = None
