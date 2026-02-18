import time
from sqlalchemy import Integer, String, ForeignKey, select
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
    words: Mapped[list["Word"]] = relationship(back_populates="user")

class Word(Base):
    __tablename__ = "words"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))
    
    word: Mapped[str] = mapped_column(String)
    definition: Mapped[str] = mapped_column(String)
    example: Mapped[str] = mapped_column(String)
    pronunciation: Mapped[str] = mapped_column(String, nullable=True)
    
    # --- SRS Logic ---
    state: Mapped[str] = mapped_column(String, default="learning") # 'learning' or 'review'
    step: Mapped[int] = mapped_column(Integer, default=0) # Index for [1m, 10m]
    next_review: Mapped[int] = mapped_column(Integer) # Unix timestamp
    interval: Mapped[int] = mapped_column(Integer, default=1) # Days (only for review)
    
    user: Mapped["User"] = relationship(back_populates="words")

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# --- CORE FUNCTIONS ---

async def add_user(user_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        
        if not user:
            session.add(User(user_id=user_id))
            await session.commit()
            return True  
            
        return False  # 👴 Old Friend

async def add_word(user_id: int, word_data: dict):
    async with AsyncSessionLocal() as session:
        # Check duplicate
        stmt = select(Word).where(Word.user_id == user_id, Word.word == word_data['word'])
        if (await session.execute(stmt)).scalar_one_or_none():
            return False

        # Add new word (Starts at Learning Step 0: 1 minute)
        new_word = Word(
            user_id=user_id,
            word=word_data['word'],
            definition=word_data['definition'],
            example=word_data['example'],
            pronunciation=word_data.get('pronunciation', ''),
            state="learning",
            step=0,
            next_review=int(time.time()) + 60, # Due in 1 min
            interval=1
        )
        session.add(new_word)
        await session.commit()
        return True

async def get_due_words(user_id: int):
    async with AsyncSessionLocal() as session:
        now = int(time.time())
        stmt = select(Word).where(Word.user_id == user_id, Word.next_review <= now).order_by(Word.next_review).limit(10)
        return (await session.execute(stmt)).scalars().all()

async def get_word(word_id: int):
    async with AsyncSessionLocal() as session:
        return await session.get(Word, word_id)

async def update_word_progress(word_id: int, remembered: bool):
    async with AsyncSessionLocal() as session:
        word = await session.get(Word, word_id)
        if not word: return

        now = int(time.time())
        LEARNING_STEPS = [1, 10] # Minutes: Step 0=1m, Step 1=10m

        if remembered:
            if word.state == "learning":
                if word.step < len(LEARNING_STEPS) - 1:
                    # Advance to next learning step (e.g. 1m -> 10m)
                    word.step += 1
                    delay_minutes = LEARNING_STEPS[word.step]
                    word.next_review = now + (delay_minutes * 60)
                else:
                    # Graduate to Review Mode (1 Day)
                    word.state = "review"
                    word.step = 0
                    word.interval = 1
                    word.next_review = now + 86400
            else:
                # Review Mode: Double the interval
                word.interval *= 2
                word.next_review = now + (word.interval * 86400)
        else:
            # Forgot? Reset to Step 0 (1 min) immediately.
            word.state = "learning"
            word.step = 0
            word.interval = 1
            word.next_review = now + 60 

        await session.commit()