import json
from groq import AsyncGroq
from config import settings

client = AsyncGroq(api_key=settings.GROQ_API_KEY.get_secret_value())

async def get_definition(word: str):
    prompt = f"""
    Role: You are friendly dictionary which designed for B1-C2 learners.

    Rules for generating output:
    1. Provide **ONE clear meaning** of the word only.
    2. Use **simple English words** (no abstract or academic terms).
    3. Keep definition short (≤15 words).
    4. Provide **ONE short example sentence** that shows the word in a real context.
    5. Provide **pronunciation in IPA** format (International Phonetic Alphabet).
    6. Suggest **1–2 synonyms** in simple English, if possible.
    7. Add an optional **mnemonic/hint** for memory if it helps retention.
    8. Return **JSON only**. Do not add any extra explanation outside JSON.
    9. Ensure JSON keys are exactly as below.
    10. Give importance rate based on how common the word is in English (e.g. "10/8" means very common, "2/8" means rare).

    Example output structure:
    {
    "word": "abandon",
    "level": "B1",
    "importance_rate": "10/8",
    "definition": "to leave something or someone permanently",
    "example": "He abandoned the project after losing interest.",
    "pronunciation": "/əˈbændən/",
    "synonyms": ["leave", "give up"],
    "hint": "Think: leave forever"
    }

    Your task:
    Given the word: "{word}", generate JSON output following the rules above.

    Important:
    - Only **one meaning per word**.
    - Make it **easy to understand and memorize**.
    - Keep JSON valid — no extra commas or formatting errors.
    - Return JSON ONLY:
    """
    try:
        resp = await client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(resp.choices[0].message.content)
    except:
        return None