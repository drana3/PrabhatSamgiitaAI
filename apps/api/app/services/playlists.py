from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount, UserPlaylist, UserPlaylistSong
from app.schemas.member import PlaylistResponse, PlaylistSongItem


def clean_playlist_name(name: str) -> str:
    cleaned = " ".join(name.split()).strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail="Playlist name cannot be empty")
    return cleaned[:120]


def playlist_response(playlist: UserPlaylist, songs: list[UserPlaylistSong]) -> PlaylistResponse:
    ordered = sorted(songs, key=lambda row: (row.position, row.created_at))
    return PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        songs=[
            PlaylistSongItem(song_number=row.song_number, position=row.position)
            for row in ordered
        ],
    )


async def list_playlists(session: AsyncSession, member: UserAccount) -> list[PlaylistResponse]:
    playlists = list(
        (
            await session.execute(
                select(UserPlaylist)
                .where(UserPlaylist.user_id == member.id)
                .order_by(UserPlaylist.created_at.asc())
            )
        ).scalars()
    )
    if not playlists:
        return []
    ids = [playlist.id for playlist in playlists]
    songs = list(
        (
            await session.execute(
                select(UserPlaylistSong).where(UserPlaylistSong.playlist_id.in_(ids))
            )
        ).scalars()
    )
    by_playlist: dict[UUID, list[UserPlaylistSong]] = {playlist.id: [] for playlist in playlists}
    for song in songs:
        by_playlist.setdefault(song.playlist_id, []).append(song)
    return [playlist_response(playlist, by_playlist.get(playlist.id, [])) for playlist in playlists]


async def owned_playlist(
    session: AsyncSession, member: UserAccount, playlist_id: UUID
) -> UserPlaylist:
    playlist = await session.get(UserPlaylist, playlist_id)
    if playlist is None or playlist.user_id != member.id:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


async def songs_for(session: AsyncSession, playlist_id: UUID) -> list[UserPlaylistSong]:
    return list(
        (
            await session.execute(
                select(UserPlaylistSong).where(UserPlaylistSong.playlist_id == playlist_id)
            )
        ).scalars()
    )
