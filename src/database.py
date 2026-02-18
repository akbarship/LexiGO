import time
from sqlalchemy import Integer, String, ForeignKey, select, Float, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from config import settings


engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[int] = mapped_column(primary_key=True)
    words: Mapped[list["UserWord"]] = relationship(back_populates="user")


class Dictionary(Base):
    __tablename__ = "dictionary"

    word: Mapped[str] = mapped_column(String, primary_key=True)
    definition: Mapped[str] = mapped_column(String)
    example: Mapped[str] = mapped_column(String)
    pronunciation: Mapped[str] = mapped_column(String, nullable=True)
    level: Mapped[str] = mapped_column(String, nullable=True)
    importance_rate: Mapped[str] = mapped_column(String, nullable=True)
    synonyms: Mapped[str] = mapped_column(String, nullable=True)


class UserWord(Base):
    __tablename__ = "words"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))

    word: Mapped[str] = mapped_column(ForeignKey("dictionary.word"))

    # Anki-Style Stats
    state: Mapped[str] = mapped_column(String, default="new")   # new | learning | review
    step: Mapped[int] = mapped_column(Integer, default=0)
    next_review: Mapped[int] = mapped_column(Integer)
    interval: Mapped[int] = mapped_column(Integer, default=0)   # Days
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)

    user: Mapped["User"] = relationship(back_populates="words")
    details: Mapped["Dictionary"] = relationship(
        primaryjoin="UserWord.word == Dictionary.word",
        foreign_keys="UserWord.word"
    )


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ─────────────────────────────────────────────
#  USER
# ─────────────────────────────────────────────

async def add_user(user_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if not user:
            session.add(User(user_id=user_id))
            await session.commit()
            return True  # New user
        return False  # Existing user


# ─────────────────────────────────────────────
#  GLOBAL DICTIONARY (Cache)
# ─────────────────────────────────────────────

async def save_to_global_dict(data: dict):
    async with AsyncSessionLocal() as session:
        word_text = data['word'].lower().strip()

        if await session.get(Dictionary, word_text):
            return  # Already cached

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
            synonyms=syns
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
            "synonyms": result.synonyms
        }


# ─────────────────────────────────────────────
#  USER STUDY LIST
# ─────────────────────────────────────────────

async def add_to_study_list(user_id: int, word_data: dict) -> bool:
    async with AsyncSessionLocal() as session:
        word = word_data['word'].lower().strip()

        # Check duplicate
        stmt = select(UserWord).where(UserWord.user_id == user_id, UserWord.word == word)
        if (await session.execute(stmt)).scalar_one_or_none():
            return False  # Already studying

        session.add(UserWord(
            user_id=user_id,
            word=word,
            state="learning",
            step=0,
            next_review=int(time.time()),   # Available immediately
            interval=1,
            ease_factor=2.5
        ))
        await session.commit()
        return True


async def get_user_dictionary(user_id: int, page: int = 0, limit: int = 5):
    async with AsyncSessionLocal() as session:
        offset = page * limit

        # Return UserWord joined with Dictionary so we have both progress + content
        stmt = (
            select(UserWord, Dictionary)
            .join(Dictionary, UserWord.word == Dictionary.word)
            .where(UserWord.user_id == user_id)
            .order_by(UserWord.id.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        rows = result.all()  # List of (UserWord, Dictionary) tuples

        # Check next page
        next_stmt = (
            select(UserWord)
            .where(UserWord.user_id == user_id)
            .limit(1)
            .offset(offset + limit)
        )
        has_next = (await session.execute(next_stmt)).scalar() is not None

        return rows, has_next


# ─────────────────────────────────────────────
#  QUIZ
# ─────────────────────────────────────────────

async def get_due_words(user_id: int):
    async with AsyncSessionLocal() as session:
        now = int(time.time())
        stmt = (
            select(UserWord, Dictionary)
            .join(Dictionary, UserWord.word == Dictionary.word)
            .where(UserWord.user_id == user_id, UserWord.next_review <= now)
            .order_by(UserWord.next_review)
            # No hard limit — all due words are fetched so quiz session is complete
        )
        result = await session.execute(stmt)
        return result.all()


async def get_study_details(user_word_id: int):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(UserWord, Dictionary)
            .join(Dictionary, UserWord.word == Dictionary.word)
            .where(UserWord.id == user_word_id)
        )
        result = await session.execute(stmt)
        return result.first()


async def update_anki_progress(word_id: int, grade: str):
    async with AsyncSessionLocal() as session:
        word = await session.get(UserWord, word_id)
        if not word:
            return

        now = int(time.time())

        if grade == "again":
            # Reset to start of learning — due immediately so it loops in same session
            word.state = "learning"
            word.step = 0
            word.interval = 0
            word.next_review = now                              # Immediately due
            word.ease_factor = max(1.3, word.ease_factor - 0.2)

        elif grade == "good":
            if word.state == "learning":
                if word.step == 0:
                    # Advance to second learning step (10 min)
                    word.step = 1
                    word.next_review = now + 600
                else:
                    # Graduate to review phase (1 day)
                    word.state = "review"
                    word.step = 0
                    word.interval = 1
                    word.next_review = now + 86400
            else:
                # Review phase: multiply interval by ease factor
                word.interval = max(1, int(word.interval * word.ease_factor))
                word.next_review = now + (word.interval * 86400)

        elif grade == "easy":
            # Skip learning steps entirely, jump to review with boosted interval
            word.state = "review"
            word.step = 0
            word.interval = max(4, int(word.interval * word.ease_factor * 1.3))
            word.next_review = now + (word.interval * 86400)
            word.ease_factor = min(3.0, word.ease_factor + 0.1)  # Cap at 3.0

        await session.commit()


# ─────────────────────────────────────────────
#  ADMIN STATS
# ─────────────────────────────────────────────

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