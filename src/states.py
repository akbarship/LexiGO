from aiogram.fsm.state import State, StatesGroup

class SearchState(StatesGroup):
    last_word = State()
    failed_words = State() # A list of word IDs missed in this session