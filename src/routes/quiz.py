from aiogram import Router, types, F
from aiogram.fsm.context import FSMContext

from ..database import get_due_words, get_study_details, update_anki_progress
from ..keyboards import main_menu_kb, quiz_show_kb, quiz_grade_kb

router = Router()


@router.callback_query(F.data == "quiz")
async def start_quiz(cb: types.CallbackQuery, state: FSMContext):
    user_id = cb.from_user.id

    due_items = await get_due_words(user_id)

    state_data = await state.get_data()
    failed_ids: list[int] = state_data.get("failed_words", [])

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

    # PRIORITY 2: Due words that are also in failed list
    if user_word is None:
        for uw, de in due_items:
            user_word, dict_entry = uw, de
            title = "🔄 <b>Re-learning Round</b>"
            break

    # PRIORITY 3: Failed words not yet due
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
        await state.update_data(failed_words=[])
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

    await start_quiz(cb, state)