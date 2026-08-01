from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.ai import router as ai_router
from app.api.v1.discovery import router as discovery_router
from app.api.v1.health import router as health_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.notation import router as notation_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.search import router as search_router
from app.api.v1.songs import router as songs_router

router = APIRouter(prefix="/api/v1")
router.include_router(health_router)
router.include_router(songs_router)
router.include_router(search_router)
router.include_router(recommendations_router)
router.include_router(inventory_router)
router.include_router(notation_router)
router.include_router(ai_router)
router.include_router(discovery_router)
router.include_router(admin_router)
