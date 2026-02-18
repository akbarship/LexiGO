from aiogram import Bot, Dispatcher, Router, F, types
from aiogram.filters import CommandStart
from aiogram.client.bot import DefaultBotProperties
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.enums import ParseMode

from database import add_user, add_word, get_due_words, get_word, update_word_progress
from llm import get_definition
from config import settings
from keyboards import main_menu_kb, add_word_kb, quiz_show_kb, quiz_grade_kb

bot = Bot(token=settings.BOT_TOKEN.get_secret_value(), default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()
router = Router()
dp.include_router(router)


@router.message(CommandStart())
async def start(msg: types.Message):
    user_id = msg.from_user.id
    is_new_user = await add_user(user_id)
    
    if is_new_user:
        welcome_text = (
            "<b>🚀 Lexi Go</b>\n"
            "<i>Your personal vocabulary architect.</i>\n\n"
            "🔍 <b>Instant Definitions</b>\n"
            "Get clear, concise meanings instantly.\n\n"
            "🧠 <b>Cue Card Memorization</b>\n"
            "Master new words effortlessly with our smart spaced repetition system.\n\n"
            "<i>⌨ Send any word to begin.</i>"
        )
        await msg.answer(welcome_text, reply_markup=main_menu_kb(), parse_mode="HTML")
        
    else:
        await msg.answer(
            "👋 Send me a word to define it, or click below to practice", 
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )