import csv
from datetime import datetime, timezone
import logging
from typing import Iterator, Dict, Any

from app.models.candle_model import CandleModel
from app.models.tick_model import TickModel

logger = logging.getLogger(__name__)

class HistoryFeeder:
    """
    Simulated data ingress for Phase 7 Backtesting Engine.
    Reads historical data files (CSV format) and yields objects sequentially.
    """
    def __init__(self, filepath: str, symbol_token: int = 1):
        self.filepath = filepath
        self.symbol_token = symbol_token

    def yield_candles(self) -> Iterator[CandleModel]:
        """
        Reads a CSV formatted with columns: timestamp, open, high, low, close, volume.
        Timestamp should be ISO format or epoch seconds.
        Yields Pydantic CandleModels representing 1-minute closed bars.
        """
        logger.info(f"HistoryFeeder initializing reading from {self.filepath}")
        
        with open(self.filepath, 'r') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                try:
                    # Parse timestamp
                    ts_raw = row['timestamp']
                    if ts_raw.isdigit() or (ts_raw.replace('.','',1).isdigit()):
                        dt_start = datetime.fromtimestamp(float(ts_raw), tz=timezone.utc)
                    else:
                        dt_start = datetime.fromisoformat(ts_raw.replace('Z', '+00:00'))

                    # We assume 1min candles based on typical data sourcing
                    dt_end = dt_start.replace(second=59, microsecond=999999)

                    candle = CandleModel(
                        instrument_token=int(row.get('instrument_token', self.symbol_token)),
                        start_time=dt_start,
                        end_time=dt_end,
                        timeframe="1min",
                        open=float(row['open']),
                        high=float(row['high']),
                        low=float(row['low']),
                        close=float(row['close']),
                        volume=int(float(row['volume'])),
                        is_closed=True
                    )
                    yield candle
                    
                except ValueError as e:
                    logger.warning(f"Skipping malformed row: {row}. Error: {e}")
                except Exception as e:
                    logger.error(f"Error parsing history row: {e}", exc_info=True)
