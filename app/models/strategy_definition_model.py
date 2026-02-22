from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class StrategyDefinition(Base):
    __tablename__ = "strategy_definitions"

    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(String(80), unique=True, index=True, nullable=False)
    name = Column(String(180), nullable=False)

    strategy_type = Column(String(64), nullable=False, default="Time Based")
    segment_type = Column(String(32), nullable=False, default="MIS")
    instrument = Column(String(64), nullable=False, default="NIFTY 50")
    start_time = Column(String(16), nullable=False, default="09:16")
    end_time = Column(String(16), nullable=False, default="15:15")

    weekdays_json = Column(Text, nullable=False, default="[]")
    legs_json = Column(Text, nullable=False, default="[]")
    advanced_json = Column(Text, nullable=False, default="{}")
    risk_json = Column(Text, nullable=False, default="{}")

    source = Column(String(32), nullable=False, default="custom_builder")

    is_deployed = Column(Boolean, nullable=False, default=False)
    runtime_symbol = Column(Integer, nullable=True)
    runtime_strategy_name = Column(String(180), nullable=True)
    deployed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
