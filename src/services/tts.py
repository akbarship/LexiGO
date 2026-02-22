import io
from gtts import gTTS


async def generate_tts(text: str, lang: str = "en", tld: str = "us") -> bytes:
    def _generate():
        tts = gTTS(text=text, lang=lang, tld=tld)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return buf.read()

    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _generate)