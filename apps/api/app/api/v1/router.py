from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.ai import router as ai_router
from app.api.v1.auth import router as auth_router
from app.api.v1.author_claims import admin_router as author_claims_admin_router
from app.api.v1.author_claims import router as author_claims_router
from app.api.v1.author_profiles import admin_router as author_profiles_admin_router
from app.api.v1.author_profiles import plays_router as author_plays_router
from app.api.v1.author_profiles import router as author_profiles_router
from app.api.v1.discovery import router as discovery_router
from app.api.v1.health import router as health_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.learn_sync import router as learn_sync_router
from app.api.v1.media import router as media_router
from app.api.v1.member_admin import router as member_admin_router
from app.api.v1.members import router as members_router
from app.api.v1.notation import router as notation_router
from app.api.v1.quiz_events import router as quiz_events_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.recording_chords import router as recording_chords_router
from app.api.v1.recording_comments import router as recording_comments_router
from app.api.v1.recording_sets import admin_router as recording_sets_admin_router
from app.api.v1.recording_sets import router as recording_sets_router
from app.api.v1.recordings import admin_router as recordings_admin_router
from app.api.v1.recordings import router as recordings_router
from app.api.v1.search import router as search_router
from app.api.v1.search_menu import admin_router as search_menu_admin_router
from app.api.v1.search_menu import router as search_menu_router
from app.api.v1.song_chords import admin_router as song_chords_admin_router
from app.api.v1.song_chords import router as song_chords_router
from app.api.v1.song_comments import router as song_comments_router
from app.api.v1.songs import router as songs_router
from app.api.v1.top_played import router as top_played_router
from app.api.v1.transliteration import router as transliteration_router
from app.api.v1.video_links import router as video_links_router

router = APIRouter(prefix="/api/v1")
router.include_router(health_router)
router.include_router(songs_router)
router.include_router(media_router)
router.include_router(search_router)
router.include_router(recommendations_router)
router.include_router(inventory_router)
router.include_router(members_router)
router.include_router(learn_sync_router)
router.include_router(auth_router)
router.include_router(member_admin_router)
router.include_router(quiz_events_router)
router.include_router(notation_router)
router.include_router(ai_router)
router.include_router(discovery_router)
router.include_router(admin_router)
router.include_router(transliteration_router)
router.include_router(recordings_router)
router.include_router(recordings_admin_router)
router.include_router(recording_sets_router)
router.include_router(recording_sets_admin_router)
router.include_router(song_comments_router)
router.include_router(song_chords_router)
router.include_router(song_chords_admin_router)
router.include_router(author_claims_router)
router.include_router(author_claims_admin_router)
router.include_router(author_profiles_router)
router.include_router(author_plays_router)
router.include_router(author_profiles_admin_router)
router.include_router(recording_comments_router)
router.include_router(recording_chords_router)
router.include_router(video_links_router)
router.include_router(search_menu_router)
router.include_router(search_menu_admin_router)
router.include_router(top_played_router)
