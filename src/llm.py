import json
from groq import AsyncGroq
from config import settings

client = AsyncGroq(api_key=settings.GROQ_API_KEY.get_secret_value())


async def get_definition(word: str):
    prompt = f"""
    Role: You are a friendly dictionary designed for B1-C2 learners.

    Rules for generating output:
    1. Provide **ONE clear meaning** of the word only.
    2. Use **simple English words** (avoid jargon).
    3. Keep definition short (≤15 words).
    4. Provide **ONE short example sentence** showing real-world context.
    5. Provide **pronunciation in IPA** format.
    6. Suggest **1–2 synonyms** in simple English.
    7. Assign a **CEFR level** (B1, B2, C1, or C2) based on difficulty.
    8. Rate the word's importance from **0 to 10** (10 = essential/very common, above 5 = extremely rare).
    9. Return **JSON only** with no extra text.

    Example output structure:
    {{
        "word": "abandon",
        "level": "B1",
        "importance_rate": 8,
        "definition": "to leave something or someone permanently",
        "example": "He abandoned the project after losing interest.",
        "pronunciation": "/əˈbændən/",
        "synonyms": ["leave", "give up"],
        "hint": "Think: leave forever"
    }}

    Your task:
    Given the word: "{word}", generate the JSON output following the rules above.
    """
    
    try:
        resp = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        print(f"LLM Error: {e}") # Helpful for debugging
        return None