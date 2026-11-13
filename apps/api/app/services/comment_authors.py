"""What happens to a member's comments when the member deletes the account.

Decision of Dada (9 November 2026): the comments STAY, shown under the name the person had, the way
a recording stays under its author's name. So before the account row goes, every NAMED comment of
the member (song comments and recording comments, top-level and replies) gets the display name
copied into `author_name`. The database then sets `member_id` to null (`ON DELETE SET NULL`).

* An ANONYMOUS comment stays anonymous: no name is stored, nothing links it to anybody afterwards.
* The picture is not kept (it is personal data); readers see the usual initial.
* After this nobody can delete, edit or "own" the comment from the app; the team can still remove
  it (the review queue), and a person who wants a comment gone writes to the team.
* A comment keeps its replies and its place in the thread.

See docs/account-deletion.md.
"""

from __future__ import annotations

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recording_extras import RecordingComment
from app.models.song_comments import SongComment
from app.services.song_comments import display_name


async def keep_comments_under_name(session: AsyncSession, member: UserAccount) -> int:
    """Stamp the member's name on their named comments. Call it before the account is deleted and
    commit together with the delete. Returns how many comments were stamped."""
    name = display_name(member)
    stamped = 0
    for model in (SongComment, RecordingComment):
        result = await session.execute(
            update(model)
            .where(model.member_id == member.id, model.is_anonymous.is_(False))
            .values(author_name=name)
        )
        stamped += int(result.rowcount or 0)
    return stamped
