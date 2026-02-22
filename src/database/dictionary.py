from sqlalchemy import select
from .engine import AsyncSessionLocal
from .models import Dictionary, UserWord


async def save_to_global_dict(data: dict):
    async with AsyncSessionLocal() as session:
        word_text = data['word'].lower().strip()

        if await session.get(Dictionary, word_text):
            return  # already cached

        syns = data.get('synonyms', '')
        if isinstance(syns, list):
            syns = ", ".join(syns)

        session.add(Dictionary(
            word=word_text,
            definition=data['definition'],
            example=data['example'],
            pronunciation=data.get('pronunciation', ''),
            level=data.get('level', 'N/A'),
            importance_rate=data.get('importance_rate', '5/10'),
            synonyms=syns,
        ))
        await session.commit()


async def get_cached_definition(word: str) -> dict | None:
    async with AsyncSessionLocal() as session:
        result = await session.get(Dictionary, word.lower().strip())
        if not result:
            return None
        return {
            "word": result.word,
            "definition": result.definition,
            "example": result.example,
            "pronunciation": result.pronunciation,
            "level": result.level,
            "importance_rate": result.importance_rate,
            "synonyms": result.synonyms,
        }


async def add_to_study_list(user_id: int, word_data: dict) -> bool:
    async with AsyncSessionLocal() as session:
        import time
        word = word_data['word'].lower().strip()

        stmt = select(UserWord).where(UserWord.user_id == user_id, UserWord.word == word)
        if (await session.execute(stmt)).scalar_one_or_none():
            return False  # already studying

        session.add(UserWord(
            user_id=user_id,
            word=word,
            state="learning",
            step=0,
            next_review=int(time.time()),
            interval=1,
            ease_factor=2.5,
        ))
        await session.commit()
        return True


async def get_user_dictionary(user_id: int, page: int = 0, limit: int = 5):
    async with AsyncSessionLocal() as session:
        offset = page * limit

        stmt = (
            select(UserWord, Dictionary)
            .join(Dictionary, UserWord.word == Dictionary.word)
            .where(UserWord.user_id == user_id)
            .order_by(UserWord.id.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await session.execute(stmt)).all()

        has_next = (
            await session.execute(
                select(UserWord)
                .where(UserWord.user_id == user_id)
                .limit(1)
                .offset(offset + limit)
            )
        ).scalar() is not None

        return rows, has_next