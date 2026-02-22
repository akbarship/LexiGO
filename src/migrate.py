import asyncio
import sqlite3
from database.models import Base, User, Dictionary, UserWord

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.dialects.mysql import insert


# ─── CONFIG ──────────────────────────────────────────────
SQLITE_PATH = "lexigo.db"
MYSQL_URL = "mysql+aiomysql://root:@localhost:3306/lexigo"
# ─────────────────────────────────────────────────────────

def read_sqlite(path: str) -> dict:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT * FROM users")
    users = [dict(row) for row in cur.fetchall()]

    cur.execute("SELECT * FROM dictionary")
    dictionary = [dict(row) for row in cur.fetchall()]

    cur.execute("SELECT * FROM words")
    words = [dict(row) for row in cur.fetchall()]

    conn.close()
    print(f"📦 Read from SQLite: {len(users)} users, {len(dictionary)} dictionary entries, {len(words)} user words")
    return {"users": users, "dictionary": dictionary, "words": words}


async def write_mysql(data: dict):
    engine = create_async_engine(MYSQL_URL, echo=False, pool_pre_ping=True)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables verified in MySQL")

    async with Session() as session:
        chunk_size = 5000

        print(f"⏳ Bulk inserting {len(data['users'])} users...")
        if data["users"]:
            for i in range(0, len(data["users"]), chunk_size):
                stmt = insert(User).values(data["users"][i:i+chunk_size])
                stmt = stmt.prefix_with("IGNORE")
                await session.execute(stmt)
            await session.commit()

        print(f"⏳ Bulk inserting {len(data['dictionary'])} dictionary entries...")
        if data["dictionary"]:
            for i in range(0, len(data["dictionary"]), chunk_size):
                stmt = insert(Dictionary).values(data["dictionary"][i:i+chunk_size])
                stmt = stmt.prefix_with("IGNORE")
                await session.execute(stmt)
            await session.commit()

        print(f"⏳ Bulk inserting {len(data['words'])} user words...")
        if data["words"]:
            for i in range(0, len(data["words"]), chunk_size):
                stmt = insert(UserWord).values(data["words"][i:i+chunk_size])
                stmt = stmt.prefix_with("IGNORE")
                await session.execute(stmt)
            await session.commit()

    print("🎉 Migration complete!")
    await engine.dispose()


async def main():
    print("🚀 Starting migration: SQLite → MySQL")
    data = read_sqlite(SQLITE_PATH)
    await write_mysql(data)


if __name__ == "__main__":
    asyncio.run(main())