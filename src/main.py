import asyncio
import logging
import sys
from bot import bot, dp
from database import init_db

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

async def main():
    await init_db()

    print("🚀 Bot is running on Polling mode...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("🛑 Bot stopped!")