import os
from aiogram import Router, types
from aiogram.filters import CommandStart, Command
from aiogram.types import FSInputFile
import asyncio

from ..core.bot import is_subscribed, subscribe_kb
from ..database import add_user
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




@router.message(Command("db"))
async def admin_send_db(msg: types.Message):
    if msg.from_user.id not in [settings.ADMIN_ID]:
        return

    await msg.answer("📤 <b>Exporting database...</b>", parse_mode="HTML")

    dump_path = "lexigo_dump.sql"

    try:
        with open(dump_path, "w") as f:
            proc = await asyncio.create_subprocess_exec(
                "mysqldump", "-u", settings.DB_USER, f"-p{settings.DB_PASSWORD}",
                "-h", settings.DB_HOST, settings.DB_NAME,
                stdout=f,
                stderr=asyncio.subprocess.PIPE
            )
            _, stderr = await proc.communicate()

        if proc.returncode != 0:
            await msg.answer(f"❌ <b>mysqldump failed:</b>\n<code>{stderr.decode()}</code>", parse_mode="HTML")
            return

        file = FSInputFile(dump_path, filename="lexigo_dump.sql")
        await msg.answer_document(document=file, caption="🗄 <b>SQL Dump</b>", parse_mode="HTML")

    except Exception as e:
        await msg.answer(f"❌ <b>Error:</b>\n<code>{str(e)}</code>", parse_mode="HTML")

    finally:
        if os.path.exists(dump_path):
            os.remove(dump_path)