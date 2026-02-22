import asyncio
from aiogram import Router, types, F, Bot
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import InlineKeyboardMarkup
from aiogram.exceptions import TelegramForbiddenError, TelegramBadRequest

from ..database import get_stats, get_all_user_ids, mark_user_inactive

# ─── CONFIG ──────────────────────────────────────────────
ADMIN_IDS = [6705677631, 7853044770]  # ← put your Telegram user_id here
# ─────────────────────────────────────────────────────────

router = Router()


class AdminStates(StatesGroup):
    waiting_for_broadcast = State()


# ─── Keyboards ───────────────────────────────────────────

def admin_panel_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="📊 Statistics", callback_data="admin_stats")
    kb.button(text="📢 Mailing", callback_data="admin_mailing")
    kb.adjust(2)
    return kb.as_markup()


def cancel_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="❌ Cancel", callback_data="admin_cancel")
    return kb.as_markup()


# ─── Guards ──────────────────────────────────────────────

def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ─── /admin command ──────────────────────────────────────

@router.message(Command("admin"))
async def handle_admin(msg: types.Message):
    if not is_admin(msg.from_user.id):
        return

    await msg.answer(
        "👨‍💼 <b>Admin Panel</b>",
        parse_mode="HTML",
        reply_markup=admin_panel_kb()
    )


# ─── Statistics ──────────────────────────────────────────

@router.callback_query(F.data == "admin_stats")
async def handle_stats(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()

    stats = await get_stats()

    text = (
        f"📊 <b>Statistics</b>\n\n"
        f"👥 Total users: <b>{stats['total_users']}</b>\n"
        f"✅ Active users: <b>{stats['active_users']}</b>\n"
        f"📚 Words in dictionary: <b>{stats['dictionary_count']}</b>"
    )

    kb = InlineKeyboardBuilder()
    kb.button(text="🔙 Back", callback_data="admin_back")

    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb.as_markup())


# ─── Mailing ─────────────────────────────────────────────

@router.callback_query(F.data == "admin_mailing")
async def handle_mailing(callback: types.CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()

    await state.set_state(AdminStates.waiting_for_broadcast)
    await callback.message.edit_text(
        "📢 <b>Mailing</b>\n\nSend me the message you want to broadcast.\nIt can be text, photo, video, or anything else.",
        parse_mode="HTML",
        reply_markup=cancel_kb()
    )


@router.callback_query(F.data == "admin_cancel")
async def handle_cancel(callback: types.CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    await state.clear()
    await callback.message.edit_text(
        "👨‍💼 <b>Admin Panel</b>",
        parse_mode="HTML",
        reply_markup=admin_panel_kb()
    )


@router.callback_query(F.data == "admin_back")
async def handle_back(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    await callback.message.edit_text(
        "👨‍💼 <b>Admin Panel</b>",
        parse_mode="HTML",
        reply_markup=admin_panel_kb()
    )


@router.message(AdminStates.waiting_for_broadcast)
async def handle_broadcast_message(msg: types.Message, state: FSMContext, bot: Bot):
    if not is_admin(msg.from_user.id):
        return

    await state.clear()

    user_ids = await get_all_user_ids()
    total = len(user_ids)

    if total == 0:
        await msg.answer("❌ No users found.")
        return

    progress_msg = await msg.answer(
        f"📤 Sending...\n\n"
        f"▱▱▱▱▱▱▱▱▱▱ 0%\n"
        f"✅ 0 / {total} sent",
    )

    sent = 0
    failed = 0
    blocked = 0

    for i, user_id in enumerate(user_ids):
        try:
            await _forward_message(bot, msg, user_id)
            sent += 1
        except TelegramForbiddenError:
            # user blocked the bot
            print(f"User {user_id} blocked the bot, marking as inactive.")  
            await mark_user_inactive(user_id)
            blocked += 1
            failed += 1
        except TelegramBadRequest:
            failed += 1
        except Exception:
            failed += 1

        # Update progress every 10 users or on last user
        if (i + 1) % 10 == 0 or (i + 1) == total:
            percent = int(((i + 1) / total) * 100)
            bar = _progress_bar(percent)
            await progress_msg.edit_text(
                f"📤 Sending...\n\n"
                f"{bar} {percent}%\n"
                f"✅ {sent} / {total} sent\n"
                f"🚫 Blocked: {blocked}"
            )

        # Flood control: 25 messages/sec is Telegram's limit, stay safe at 20
        await asyncio.sleep(0.05)

    await progress_msg.edit_text(
        f"✅ <b>Mailing complete!</b>\n\n"
        f"👥 Total: <b>{total}</b>\n"
        f"✅ Sent: <b>{sent}</b>\n"
        f"🚫 Blocked: <b>{blocked}</b>\n"
        f"❌ Failed: <b>{failed}</b>",
        parse_mode="HTML",
        reply_markup=admin_panel_kb()
    )


# ─── Helpers ─────────────────────────────────────────────

async def _forward_message(bot: Bot, msg: types.Message, user_id: int):
    """Copy any type of message to user."""
    await bot.copy_message(
        chat_id=user_id,
        from_chat_id=msg.chat.id,
        message_id=msg.message_id
    )


def _progress_bar(percent: int, length: int = 10) -> str:
    filled = int(length * percent / 100)
    return "▰" * filled + "▱" * (length - filled)