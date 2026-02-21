import os
from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: str = "false") -> bool:
    value = os.getenv(name, default)
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


class Config:
    KITE_API_KEY = os.getenv("KITE_API_KEY", "")
    KITE_API_SECRET = os.getenv("KITE_API_SECRET", "")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db") # Default to SQLite for initial testing if no PG provided
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    CORS_ALLOWED_ORIGINS = _env_csv("CORS_ALLOWED_ORIGINS")
    ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN", "")
    BACKTEST_API_ENABLED = _env_bool("BACKTEST_API_ENABLED", "true")
    BACKTEST_SAVE_DIR = os.getenv("BACKTEST_SAVE_DIR", "data/backtests")

config = Config()
