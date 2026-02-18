from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

def main_menu_kb() -> InlineKeyboardMarkup:
    """The main start menu."""
    kb = InlineKeyboardBuilder()
    kb.button(text="🧠 Start Review", callback_data="quiz")
    kb.button(text="📚 My Dictionary", callback_data="dict_list") # Added for future use
    kb.adjust(2)
    return kb.as_markup()

def add_word_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="➕ Add to Dictionary", callback_data="add_word")
    return kb.as_markup()

def quiz_show_kb(word_id: int) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="👀 Show Definition", callback_data=f"show:{word_id}")
    return kb.as_markup()

def quiz_grade_kb(word_id: int) -> InlineKeyboardMarkup:
    """Quiz Step 2: Grade yourself."""
    kb = InlineKeyboardBuilder()
    kb.button(text="❌ Forgot", callback_data=f"grade:{word_id}:0")
    kb.button(text="✅ Remembered", callback_data=f"grade:{word_id}:1")
    kb.adjust(2) # 2 buttons per row
    return kb.as_markup()