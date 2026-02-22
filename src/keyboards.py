from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder


def main_menu_kb() -> InlineKeyboardMarkup:
    """The main start menu."""
    kb = InlineKeyboardBuilder()
    kb.button(text="🧠 Start Review", callback_data="quiz")
    kb.button(text="📚 My Dictionary", callback_data="dict_list") # Added for future use
    kb.adjust(2)
    return kb.as_markup()

def dict_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="📚 My Dictionary", callback_data="dict_list") # Added for future use
    kb.adjust(1)
    return kb.as_markup()


def dictionary_pagination_kb(page: int, has_next: bool) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    
    # Navigation buttons
    nav_buttons = []
    if page > 0:
        nav_buttons.append(InlineKeyboardButton(text="⬅️ Previous", callback_data=f"dict_page:{page-1}"))
    if has_next:
        nav_buttons.append(InlineKeyboardButton(text="Next ➡️", callback_data=f"dict_page:{page+1}"))
    
    kb.row(*nav_buttons)
    kb.row(InlineKeyboardButton(text="🏠 Main Menu", callback_data="main_menu"))
    
    return kb.as_markup()

def back_to_menu_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="🏠 Main Menu", callback_data="main_menu")
    return kb.as_markup()


def add_word_kb(word: str) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="➕ Add to Dictionary", callback_data="add_word")
    kb.button(text="🔊 Pronunciation", callback_data=f"play_audio:{word}")
    kb.adjust(2)
    return kb.as_markup()

def quiz_show_kb(word_id: int) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="👀 Show Definition", callback_data=f"show:{word_id}")
    kb.button(text="🚪 Quit Quiz", callback_data="main_menu") # Exit button
    kb.adjust(1)
    return kb.as_markup()

def quiz_grade_kb(word_id: int) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="🔴 Again", callback_data=f"grade:{word_id}:again")
    kb.button(text="🟢 Good", callback_data=f"grade:{word_id}:good")
    kb.button(text="💎 Easy", callback_data=f"grade:{word_id}:easy")
    
    kb.button(text="🚪 Quit Quiz", callback_data="main_menu")
    kb.adjust(3, 1)
    return kb.as_markup()

