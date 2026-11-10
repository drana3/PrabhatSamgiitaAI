"""Words authors write under "Add your own", and the team's answers.

See services/value_suggestions.py.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Field_ = Literal["instrument", "style", "mood", "language", "mantra"]
Status = Literal["pending", "accepted", "merged", "rejected"]


class AcceptedWord(BaseModel):
    key: str
    label: str


class ValueOptions(BaseModel):
    """What the form may offer next to the fixed list: the words the team accepted."""

    field: Field_
    accepted: list[AcceptedWord]
    # How many new words one person may bring a week (the form says it next to the field).
    new_words_per_week: int


class MergeTarget(BaseModel):
    """A listed value a word can be merged into (the code the API takes, a name to show)."""

    code: str
    label: str


class SuggestionOut(BaseModel):
    id: str
    field: Field_
    label: str
    key: str
    status: Status
    similar_to: str | None = None
    merged_into: str | None = None
    recordings_count: int
    people_count: int
    created_at: datetime | None = None
    decided_by: str | None = None
    decided_at: datetime | None = None
    # The team's screen (additive): who wrote the word first, and the listed values to merge into.
    first_by: str | None = None
    merge_targets: list[MergeTarget] = Field(default_factory=list)


class SuggestionList(BaseModel):
    items: list[SuggestionOut]
    total: int


class Decision(BaseModel):
    action: Literal["accept", "merge", "reject"]
    # merge: the listed value the word means (a code of the instruments or the styles).
    merge_into: str | None = Field(default=None, max_length=32)
    # accept: the team may fix the spelling of the word it accepts.
    label: str | None = Field(default=None, max_length=80)
