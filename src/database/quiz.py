import time
from sqlalchemy import select
from .engine import AsyncSessionLocal
from .models import UserWord, Dictionary


async def get_due_words(user_id: int):
    async with AsyncSessionLocal() as session:
        now = int(time.time())
        stmt = (
            select(UserWord, Dictionary)
            .join(Dictionary, UserWord.word == Dictionary.word)
            .where(UserWord.user_id == user_id, UserWord.next_review <= now)
            .order_by(UserWord.next_review)
        )
        return (await session.execute(stmt)).all()


async def get_study_details(user_word_id: int):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(UserWord, Dictionary)
            .join(Dictionary, UserWord.word == Dictionary.word)
            .where(UserWord.id == user_word_id)
        )
        return (await session.execute(stmt)).first()


async def update_anki_progress(word_id: int, grade: str):
    async with AsyncSessionLocal() as session:
        word = await session.get(UserWord, word_id)
        if not word:
            return

        now = int(time.time())

        if grade == "again":
            word.state = "learning"
            word.step = 0
            word.interval = 0
            word.next_review = now
            word.ease_factor = max(1.3, word.ease_factor - 0.2)

        elif grade == "good":
            if word.state == "learning":
                if word.step == 0:
                    word.step = 1
                    word.next_review = now + 600        # 10 min
                else:
                    word.state = "review"
                    word.step = 0
                    word.interval = 1
                    word.next_review = now + 86400      # 1 day
            else:
                word.interval = max(1, int(word.interval * word.ease_factor))
                word.next_review = now + (word.interval * 86400)

        elif grade == "easy":
            word.state = "review"
            word.step = 0
            word.interval = max(4, int(word.interval * word.ease_factor * 1.3))
            word.next_review = now + (word.interval * 86400)
            word.ease_factor = min(3.0, word.ease_factor + 0.1)

        await session.commit()