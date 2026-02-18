from aiogram import Bot, Dispatcher, Router, F, types
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.client.bot import DefaultBotProperties
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.enums import ParseMode

from database import add_user, save_to_global_dict, get_cached_definition, add_to_study_list, get_user_dictionary, get_admin_stats, update_anki_progress, get_due_words, get_study_details
from llm import get_definition
from config import settings
from keyboards import main_menu_kb, add_word_kb, quiz_show_kb, quiz_grade_kb, dict_kb, dictionary_pagination_kb

bot = Bot(token=settings.BOT_TOKEN.get_secret_value(), default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()
router = Router()
dp.include_router(router)


# ─────────────────────────────────────────────
#  MAIN MENU
# ─────────────────────────────────────────────

@router.callback_query(F.data == "main_menu")
async def callback_main_menu(cb: types.CallbackQuery):
    try:
        await cb.message.edit_text(
            text="👋 Send me a word to define it, or click below to practice",
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )
    except Exception:
        pass
    await cb.answer()


# ─────────────────────────────────────────────
#  START
# ─────────────────────────────────────────────

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

# ADMIN COMMANDS
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
# ─────────────────────────────────────────────
#  WORD SEARCH
# ─────────────────────────────────────────────

@router.message(F.text)
async def handle_search(msg: types.Message, state: FSMContext):
    word = msg.text.strip().lower()
    if word.startswith("/"):
        return

    wait_msg = await msg.answer("🔍 <i>Searching...</i>", parse_mode="HTML")

    data = await get_cached_definition(word)
    if not data:
        data = await get_definition(word)
        if data:
            await save_to_global_dict(data)

    if not data:
        await wait_msg.edit_text("❌ <b>Word not found.</b>", parse_mode="HTML")
        return

    # Only update last_word, preserve quiz FSM state (failed_words etc.)
    await state.update_data(last_word=data['word'])

    synonyms_text = data.get('synonyms', '-')
    if isinstance(synonyms_text, list):
        synonyms_text = ", ".join(synonyms_text)

    response_text = (
        f"🇬🇧 <b>{data['word']}</b>   <code>{data.get('level', 'N/A')}</code>\n"
        f"⭐️ <b>Importance:</b> {data.get('importance_rate', '5/10')}\n\n"
        f"📖 <b>Definition:</b>\n"
        f"{data['definition']}\n\n"
        f"✍️ <b>Example:</b>\n"
        f"<i>{data['example']}</i>\n\n"
        f"🔊 <b>Pronunciation:</b> <code>{data.get('pronunciation', '')}</code>\n"
        f"🔄 <b>Synonyms:</b> {synonyms_text}"
    )

    await wait_msg.edit_text(response_text, reply_markup=add_word_kb(), parse_mode="HTML")


# ─────────────────────────────────────────────
#  ADD WORD
# ─────────────────────────────────────────────

@router.callback_query(F.data == "add_word")
async def callback_add_word(cb: types.CallbackQuery, state: FSMContext):
    user_id = cb.from_user.id

    user_data = await state.get_data()
    word = user_data.get("last_word")

    if not word:
        await cb.answer("⚠️ Session expired. Search again.", show_alert=True)
        return

    word_to_add = await get_cached_definition(word)
    success = await add_to_study_list(user_id, word_to_add)

    if success:
        await cb.answer("✅ Added to your study list!")
        # Only clear last_word, keep failed_words and other quiz state intact
        await state.update_data(last_word=None)
        await cb.message.edit_reply_markup(reply_markup=dict_kb())
    else:
        await cb.answer("⚠️ Already in your list.", show_alert=True)


# ─────────────────────────────────────────────
#  DICTIONARY
# ─────────────────────────────────────────────

@router.callback_query(F.data == "dict_list")
@router.callback_query(F.data.startswith("dict_page:"))
async def show_dictionary(cb: types.CallbackQuery):
    page = 0
    if ":" in cb.data:
        page = int(cb.data.split(":")[1])

    user_id = cb.from_user.id
    words, has_next = await get_user_dictionary(user_id, page=page)

    if not words and page == 0:
        await cb.answer("Your dictionary is empty. Search some words first!", show_alert=True)
        return

    text_lines = ["<b>📚 Your Dictionary</b>\n"]
    for i, (user_word, w) in enumerate(words, 1):
        text_lines.append(f"{i}. <b>{w.word.capitalize()}</b> <code>{w.level}</code>")
        text_lines.append(f"└ <i>{w.definition}</i>\n")

    full_text = "\n".join(text_lines)

    try:
        await cb.message.edit_text(
            full_text,
            reply_markup=dictionary_pagination_kb(page, has_next),
            parse_mode="HTML"
        )
    except Exception:
        pass
    await cb.answer()


# ─────────────────────────────────────────────
#  QUIZ — START / NEXT CARD
# ─────────────────────────────────────────────

@router.callback_query(F.data == "quiz")
async def start_quiz(cb: types.CallbackQuery, state: FSMContext):
    user_id = cb.from_user.id

    due_items = await get_due_words(user_id)

    state_data = await state.get_data()
    failed_ids: list[int] = state_data.get("failed_words", [])

    # Remove failed_ids that are already covered by due_items to avoid duplicates
    due_word_ids = {uw.id for uw, _ in due_items}
    unique_failed_ids = [wid for wid in failed_ids if wid not in due_word_ids]

    user_word = None
    dict_entry = None
    title = ""

    # PRIORITY 1: Regular due words (skip ones already in failed list)
    for uw, de in due_items:
        if uw.id not in failed_ids:
            user_word, dict_entry = uw, de
            title = "🃏 <b>Flashcard</b>"
            break

    # PRIORITY 2: Due words that are also in failed list (show after fresh ones)
    if user_word is None:
        for uw, de in due_items:
            user_word, dict_entry = uw, de
            title = "🔄 <b>Re-learning Round</b>"
            break

    # PRIORITY 3: Failed words not yet due (edge case)
    if user_word is None and unique_failed_ids:
        next_id = unique_failed_ids[0]
        result = await get_study_details(next_id)
        if not result:
            unique_failed_ids.pop(0)
            await state.update_data(failed_words=unique_failed_ids)
            return await start_quiz(cb, state)
        user_word, dict_entry = result
        title = "🔄 <b>Re-learning Round</b>"

    # PRIORITY 4: Nothing left
    if user_word is None:
        await state.update_data(failed_words=[])  # Clean up
        await cb.message.edit_text(
            "<b>🎉 Session Complete!</b>\n"
            "You have no more words to review right now.\n\n"
            "<i>Take a break or search for new words.</i>",
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )
        return

    await cb.message.edit_text(
        f"{title}\n\n"
        f"🚩 <b>{dict_entry.word.upper()}</b>\n\n"
        f"✨ {dict_entry.level}\n 🔊 Pronunciation: <code>{dict_entry.pronunciation}</code>",
        reply_markup=quiz_show_kb(user_word.id),
        parse_mode="HTML"
    )
    await cb.answer()


# ─────────────────────────────────────────────
#  QUIZ — SHOW DEFINITION
# ─────────────────────────────────────────────

@router.callback_query(F.data.startswith("show:"))
async def show_definition(cb: types.CallbackQuery):
    word_id = int(cb.data.split(":")[1])

    result = await get_study_details(word_id)
    if not result:
        await cb.answer("Word not found.", show_alert=True)
        return

    user_word, dict_entry = result

    synonyms_text = dict_entry.synonyms or "-"

    await cb.message.edit_text(
        f"🃏 <b>Flashcard</b>\n\n"
        f"🚩 <b>{dict_entry.word.upper()}</b>  <code>{dict_entry.level}</code>\n"
        f"🔊 <code>{dict_entry.pronunciation}</code>\n\n"
        f"📖 <b>Definition:</b>\n{dict_entry.definition}\n\n"
        f"✍️ <b>Example:</b>\n<i>{dict_entry.example}</i>\n\n"
        f"🔄 <b>Synonyms:</b> {synonyms_text}\n\n"
        f"<i>How well did you remember it?</i>",
        reply_markup=quiz_grade_kb(word_id),
        parse_mode="HTML"
    )
    await cb.answer()


# ─────────────────────────────────────────────
#  QUIZ — GRADE
# ─────────────────────────────────────────────

@router.callback_query(F.data.startswith("grade:"))
async def handle_quiz_grade(cb: types.CallbackQuery, state: FSMContext):
    _, word_id_str, grade = cb.data.split(":")
    word_id = int(word_id_str)

    await update_anki_progress(word_id, grade)

    data = await state.get_data()
    failed_list: list[int] = data.get("failed_words", [])

    if grade == "again":
        if word_id not in failed_list:
            failed_list.append(word_id)
    else:
        if word_id in failed_list:
            failed_list.remove(word_id)

    await state.update_data(failed_words=failed_list)
    await cb.answer(f"{'❌' if grade == 'again' else '✅'} {grade.capitalize()}")

    # Go to next card
    await start_quiz(cb, state)


