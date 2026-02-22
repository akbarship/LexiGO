import os
from aiogram import Router, types
from aiogram.filters import CommandStart, Command
from aiogram.types import FSInputFile

from ..core.bot import is_subscribed, subscribe_kb
from ..database import add_user, get_admin_stats
from ..keyboards import main_menu_kb
from ..config import settings

router = Router()


@router.callback_query(lambda cb: cb.data == "check_subscription")
async def check_subscription(cb: types.CallbackQuery):
    if await is_subscribed(cb.from_user.id):
        await cb.message.delete()
        await cb.message.answer(
            "✅ <b>Thanks for subscribing!</b>\n\n"
            "👋 Send me a word to define it, or click below to practice",
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )
    else:
        await cb.answer("❌ You haven't subscribed yet!", show_alert=True)


@router.message(CommandStart())
async def start(msg: types.Message):
    user_id = msg.from_user.id
    is_new_user = await add_user(user_id)

    if not await is_subscribed(user_id):
        await msg.answer(
            "👋 Welcome to <b>Lexi Go!</b>\n\n"
            "📢 To use the bot, please join our channel first:",
            reply_markup=subscribe_kb(),
            parse_mode="HTML"
        )
        return

    if is_new_user:
        await msg.answer(
            "<b>🚀 Lexi Go</b>\n"
            "<i>Your personal vocabulary architect.</i>\n\n"
            "🔍 <b>Instant Definitions</b>\n"
            "Get clear, concise meanings instantly.\n\n"
            "🧠 <b>Cue Card Memorization</b>\n"
            "Master new words effortlessly with our smart spaced repetition system.\n\n"
            "<i>⌨ Send any word to begin.</i>",
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )
    else:
        await msg.answer(
            "👋 Send me a word to define it, or click below to practice",
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )


@router.message(Command("stats"))
async def admin_stats(msg: types.Message):
    print(f"Admin {msg.from_user.id} requested stats.")
    if msg.from_user.id not in [settings.ADMIN_ID]:
        return

    stats = await get_admin_stats()
    await msg.answer(
        f"<b>📊 Admin Stats</b>\n\n"
        f"👥 <b>Total Users:</b> {stats['total_users']}\n"
        f"📖 <b>Global Dictionary:</b> {stats['total_dict_words']} words\n"
        f"🧠 <b>Words Being Studied:</b> {stats['total_user_words']}",
        parse_mode="HTML"
    )


@router.message(Command("db"))
async def admin_send_db(msg: types.Message):
    print(f"Admin {msg.from_user.id} requested database export.")

    if msg.from_user.id not in [settings.ADMIN_ID]:
        return

    db_path = "lexigo.db"

    if not os.path.exists(db_path):
        await msg.answer("❌ <b>Error:</b> Database file not found on server.", parse_mode="HTML")
        return

    await msg.answer("📤 <b>Uploading database...</b>", parse_mode="HTML")

    try:
        db_file = FSInputFile(db_path)
        await msg.answer_document(
            document=db_file,
            caption="🗄 <b>Database Backup</b>",
            parse_mode="HTML"
        )
    except Exception as e:
        await msg.answer(f"❌ <b>Error sending file:</b>\n<code>{str(e)}</code>", parse_mode="HTML")