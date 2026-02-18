from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr

class Settings(BaseSettings):
    BOT_TOKEN: SecretStr
    GROQ_API_KEY: SecretStr
    DATABASE_URL: str = "sqlite+aiosqlite:///./lexigo.db"
    ADMIN_ID: int

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()