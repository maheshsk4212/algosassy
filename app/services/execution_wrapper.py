import logging
from typing import Callable, Any
from fastapi.concurrency import run_in_threadpool
import kiteconnect.exceptions as kite_exc

logger = logging.getLogger(__name__)

async def execute_kite_call(func: Callable, *args, **kwargs) -> Any:
    """
    Wraps asynchronous execution of blocking Kite Connect API calls 
    using FastAPI's threadpool to prevent blocking the event loop.
    Centralized exception handling for Kite specific errors.
    """
    try:
        # Structured logging for the call
        logger.debug(f"Executing Kite API call: {func.__name__}", extra={
             "args": args,
             "kwargs": kwargs
        })
        result = await run_in_threadpool(func, *args, **kwargs)
        return result
    except kite_exc.TokenException as e:
        logger.error(f"Kite Token Error in {func.__name__}: {str(e)}")
        # Re-raise to be handled by auth manager/middlewares
        raise
    except kite_exc.KiteException as e:
        logger.error(f"Kite API Error in {func.__name__}: {str(e)}")
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in Kite API call {func.__name__}: {str(e)}")
        raise
