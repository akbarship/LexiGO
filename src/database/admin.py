from sqlalchemy import select, func
from .engine import AsyncSessionLocal
from .models import User, Dictionary, UserWord


async def get_admin_stats() -> dict:
    async with AsyncSessionLocal() as session:
        total_users = (await session.execute(select(func.count()).select_from(User))).scalar()
        total_dict_words = (await session.execute(select(func.count()).select_from(Dictionary))).scalar()
        total_user_words = (await session.execute(select(func.count()).select_from(UserWord))).scalar()

        return {
            "total_users": total_users,
            "total_dict_words": total_dict_words,
            "total_user_words": total_user_words,
        }   