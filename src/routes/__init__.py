from .start import router as start_router
from .search import router as search_router
from .menu import router as menu_router
from .dictionary import router as dictionary_router
from .quiz import router as quiz_router
from .admin import router as admin_router

def register_all_routers(dp):
    dp.include_router(start_router)
    dp.include_router(admin_router)
    dp.include_router(search_router)
    dp.include_router(menu_router)
    dp.include_router(dictionary_router)
    dp.include_router(quiz_router)