from aiogram import Router, types, F
from aiogram.fsm.context import FSMContext

from core.bot import is_subscribed, subscribe_kb
from database import add_user, get_cached_definition, save_to_global_dict
from services.llm import get_definition
from keyboards import add_word_kb

router = Router()


@router.message(F.text)
async def handle_search(msg: types.Message, state: FSMContext):
    word = msg.text.strip().lower()
    user_id = msg.from_user.id
    await add_user(user_id)

    if word.startswith("/"):
        return

    if not await is_subscribed(msg.from_user.id):
        await msg.answer(
            "📢 You need to join our channel to use this bot:",
            reply_markup=subscribe_kb(),
            parse_mode="HTML"
        )
        return

    wait_msg = await msg.answer("🔍 <i>Searching...</i>", parse_mode="HTML")

    data = await get_cached_definition(word)
    if not data:
        data = await get_definition(word)
        if data:
            await save_to_global_dict(data)

    print(data)


    if not data:
        await wait_msg.edit_text("❌ <b>Word not found.</b>", parse_mode="HTML")
        return

    await state.update_data(last_word=data['word'])

    synonyms_text = data.get('synonyms', '-')
    if isinstance(synonyms_text, list):
        synonyms_text = ", ".join(synonyms_text)

    response_text = (
        f"🇬🇧 <b>{data['word']}</b>   <code>{data.get('level', 'N/A')}</code>\n"
        f"⭐️ <b>Importance:</b> 10/{data.get('importance_rate', '5/10')}\n\n"
        f"📖 <b>Definition:</b>\n"
        f"{data['definition']}\n\n"
        f"✍️ <b>Example:</b>\n"
        f"<i>{data['example']}</i>\n\n"
        f"🇺🇿 <b>Uzbek Meaning:</b> {data.get('uzbek_meaning', '-')}\n"
        f"🔊 <b>Pronunciation:</b> <code>{data.get('pronunciation', '')}</code>\n"
        f"🔄 <b>Synonyms:</b> {synonyms_text}"
    )

    await wait_msg.edit_text(response_text, reply_markup=add_word_kb(), parse_mode="HTML")