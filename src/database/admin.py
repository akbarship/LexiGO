from sqlalchemy import select, func, update
from .engine import AsyncSessionLocal
from .models import User, Dictionary, UserWord

async def get_stats() -> dict:
    async with AsyncSessionLocal() as session:
        total_users = await session.scalar(select(func.count()).select_from(User))
        active_users = await session.scalar(select(func.count()).select_from(User).where(User.active == True))
        dictionary_count = await session.scalar(select(func.count()).select_from(Dictionary))

    return {
        "total_users": total_users,
        "active_users": active_users,
        "dictionary_count": dictionary_count,
    }


async def get_all_user_ids() -> list[int]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User.user_id)
        )
        return list(result.scalars().all())


async def mark_user_inactive(user_id: int):
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(User).where(User.user_id == user_id).values(active=False)
        )
        await session.commit()


