from app.models.trade_intent import TradeIntent, TradeDirection

def test_intent_immutability():
    intent = TradeIntent(
        strategy_name="EMA_Cross",
        symbol=256265,
        direction=TradeDirection.BUY,
        entry_price=100.0,
        stop_loss=98.0,
        target=105.0
    )
    
    # Attempting to modify should raise exception
    try:
        intent.entry_price = 105.0
        print("FAIL: TradeIntent is mutable!")
    except Exception as e:
        print(f"SUCCESS: TradeIntent is immutable. Error raised: {type(e).__name__} - {e}")

if __name__ == "__main__":
    test_intent_immutability()
