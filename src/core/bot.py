from aiogram import Bot, Dispatcher
from aiogram.client.bot import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from config import settings

bot = Bot(
    token=settings.BOT_TOKEN.get_secret_value(),
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
dp = Dispatcher()

CHANNEL_ID = "@akbarshokh_blogs"
CHANNEL_USERNAME = "akbarshokh_blogs"


async def is_subscribed(user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(CHANNEL_ID, user_id)
        print(f"User {user_id} status: {member.status}")
        return member.status in ("member", "administrator", "creator")
    except Exception as e:
        print(f"Subscription check error: {e}")
        return True


def subscribe_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="📢 Join Channel", url=f"https://t.me/{CHANNEL_USERNAME.lstrip('@')}")
    kb.button(text="✅ I Subscribed", callback_data="check_subscription")
    kb.adjust(1)
    return kb.as_markup()