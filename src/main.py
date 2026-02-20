import asyncio
import logging
import sys
from core import bot, dp
from database import init_db
from routes import register_all_routers

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

async def main():
    await init_db()
    register_all_routers(dp)
    print("🚀 Bot is running on Polling mode...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("🛑 Bot stopped!")