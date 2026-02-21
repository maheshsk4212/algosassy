import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    KITE_API_KEY = os.getenv("KITE_API_KEY", "")
    KITE_API_SECRET = os.getenv("KITE_API_SECRET", "")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db") # Default to SQLite for initial testing if no PG provided
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

config = Config()
