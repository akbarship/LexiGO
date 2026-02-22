import asyncio
import aiohttp
from aiogram import Router, types, F
from aiogram.fsm.context import FSMContext

from ..core.bot import is_subscribed, subscribe_kb
from ..database import add_user, get_cached_definition, save_to_global_dict
from ..services import get_definition, generate_tts
from ..services.word_audio import get as get_audio 
from ..keyboards import add_word_kb, back_to_menu_kb

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
        print(f"Fetched from API: {data}")  # Debug log
        if data:
            await save_to_global_dict(data)

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

    await wait_msg.edit_text(response_text, reply_markup=add_word_kb(data["word"]), parse_mode="HTML")


# ─── Audio callback ───────────────────────────────────────────────────────────
@router.callback_query(F.data.startswith("play_audio:"))
async def handle_play_audio(callback: types.CallbackQuery):
    await callback.answer()

    word = callback.data.split(":", 1)[1]

    wait_msg = await callback.message.answer("🔊 <i>Loading pronunciation...</i>", parse_mode="HTML")

    data = await get_cached_definition(word)
    audio_url = data.get("audio") if data else None

    try:
        if audio_url:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64)"}
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(audio_url) as resp:
                    audio_bytes = await resp.read()
        else:
            audio_bytes = await generate_tts(word)

        audio_file = types.BufferedInputFile(audio_bytes, filename=f"{word}.mp3")
        await wait_msg.delete()
        await callback.message.answer_audio(
            audio=audio_file,
            caption=f"🔊 Pronunciation of <b>{word}</b>",
            parse_mode="HTML",
            reply_markup=back_to_menu_kb()
        )
    except Exception:
        await wait_msg.delete()
        await callback.message.answer("😔 Sorry, I couldn't load the audio right now.")