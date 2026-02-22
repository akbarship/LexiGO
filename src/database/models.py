from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import BigInteger, Integer, String, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from .engine import Base


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    active: Mapped[bool] = mapped_column(default=True)

class Dictionary(Base):
    __tablename__ = "dictionary"
    word: Mapped[str] = mapped_column(String(255), primary_key=True)
    definition: Mapped[str] = mapped_column(String(1000))
    example: Mapped[str] = mapped_column(String(1000))
    pronunciation: Mapped[str] = mapped_column(String(255), nullable=True)
    level: Mapped[str] = mapped_column(String(50), nullable=True)
    importance_rate: Mapped[str] = mapped_column(String(50), nullable=True)
    synonyms: Mapped[str] = mapped_column(String(500), nullable=True)


class UserWord(Base):
    __tablename__ = "words"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"))
    word: Mapped[str] = mapped_column(String(255), ForeignKey("dictionary.word"))
    state: Mapped[str] = mapped_column(String(50), default="new")
    step: Mapped[int] = mapped_column(Integer, default=0)
    next_review: Mapped[int] = mapped_column(Integer)
    interval: Mapped[int] = mapped_column(Integer, default=0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)