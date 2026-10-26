"""Simple, testable momentum / trend signals."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

import pandas as pd
from loguru import logger


SignalType = Literal["buy", "sell", "hold"]


@dataclass
class Signal:
    symbol: str
    signal: SignalType
    strength: float          # 0–1
    reason: str
    price: float
    timestamp: pd.Timestamp


class MomentumSignal:
    """
    Classic price-momentum rule:
    - Buy when close is X% above the N-day simple moving average
    - Sell / exit when it falls back below or after holding period
    Purely statistical, no black-box ML required to start.
    """

    def __init__(
        self,
        lookback: int = 20,
        threshold: float = 0.02,
        holding_period: int = 5,
    ):
        self.lookback = lookback
        self.threshold = threshold
        self.holding_period = holding_period

    def generate(self, symbol: str, bars: pd.DataFrame) -> Optional[Signal]:
        if bars is None or len(bars) < self.lookback + 5:
            return None

        close = bars["close"]
        sma = close.rolling(self.lookback).mean()
        latest_close = float(close.iloc[-1])
        latest_sma = float(sma.iloc[-1])
        if pd.isna(latest_sma) or latest_sma == 0:
            return None

        momentum = (latest_close - latest_sma) / latest_sma
        ts = bars.index[-1]

        if momentum >= self.threshold:
            strength = min(1.0, abs(momentum) / (self.threshold * 3))
            return Signal(
                symbol=symbol,
                signal="buy",
                strength=strength,
                reason=f"Momentum {momentum:.2%} above {self.lookback}d SMA",
                price=latest_close,
                timestamp=ts,
            )
        elif momentum <= -self.threshold:
            strength = min(1.0, abs(momentum) / (self.threshold * 3))
            return Signal(
                symbol=symbol,
                signal="sell",
                strength=strength,
                reason=f"Momentum {momentum:.2%} below {self.lookback}d SMA",
                price=latest_close,
                timestamp=ts,
            )
        else:
            return Signal(
                symbol=symbol,
                signal="hold",
                strength=0.0,
                reason="No clear momentum edge",
                price=latest_close,
                timestamp=ts,
            )

    def batch(self, data: dict[str, pd.DataFrame]) -> list[Signal]:
        signals = []
        for symbol, bars in data.items():
            sig = self.generate(symbol, bars)
            if sig and sig.signal != "hold":
                signals.append(sig)
                logger.debug(f"{symbol}: {sig.signal.upper()} ({sig.strength:.2f}) – {sig.reason}")
        return signals
