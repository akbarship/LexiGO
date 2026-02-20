from aiogram import Router, types, F

from database import get_user_dictionary
from keyboards import dictionary_pagination_kb

router = Router()


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