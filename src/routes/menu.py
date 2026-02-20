from aiogram import Router, types, F
from aiogram.fsm.context import FSMContext

from database import get_cached_definition, add_to_study_list
from keyboards import main_menu_kb, dict_kb

router = Router()


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
        await state.update_data(last_word=None)
        await cb.message.edit_reply_markup(reply_markup=dict_kb())
    else:
        await cb.answer("⚠️ Already in your list.", show_alert=True)