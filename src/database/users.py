from database.engine import AsyncSessionLocal
from database.models import User


async def add_user(user_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if not user:
            session.add(User(user_id=user_id))
            await session.commit()
            return True   # new user
        return False      # existing user