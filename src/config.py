from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr

class Settings(BaseSettings):
    BOT_TOKEN: SecretStr
    OPENAI_API_KEY: SecretStr
    DATABASE_URL: str
    ADMIN_ID: int = 7853044770
    DB_HOST="localhost"
    DB_PORT: int
    DB_USER: str
    DB_PASSWORD:str
    DB_NAME: str

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()