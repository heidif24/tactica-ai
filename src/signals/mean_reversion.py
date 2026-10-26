"""Conservative mean-reversion (pendulum-style) signal.

Idea: price oscillates around a moving average. When it stretches too far
(like a pendulum), it tends to snap back. We only act on statistically
extreme deviations and require confirmation.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd
from loguru import logger

from src.signals.momentum import Signal


class MeanReversionSignal:
    """
    Mean-reversion / pendulum-inspired rules:
    - Compute z-score of price vs SMA.
    - Buy only when price is significantly *below* the mean (oversold).
    - Sell when price is significantly *above* the mean (overbought).
    - Extra filters: volume confirmation + longer-term trend filter to avoid
      fighting strong trends.
    """

    def __init__(
        self,
        lookback: int = 20,
        z_entry: float = 1.8,
        z_exit: float = 0.3,
        max_holding_bars: int = 8,
        require_volume_confirm: bool = True,
        trend_filter_lookback: int = 50,
    ):
        self.lookback = lookback
        self.z_entry = z_entry
        self.z_exit = z_exit
        self.max_holding_bars = max_holding_bars
        self.require_volume_confirm = require_volume_confirm
        self.trend_filter_lookback = trend_filter_lookback

    def generate(self, symbol: str, bars: pd.DataFrame) -> Optional[Signal]:
        if bars is None or len(bars) < max(self.lookback, self.trend_filter_lookback) + 5:
            return None

        close = bars["close"].astype(float)
        volume = bars["volume"].astype(float) if "volume" in bars.columns else None

        sma = close.rolling(self.lookback).mean()
        std = close.rolling(self.lookback).std()
        latest_close = float(close.iloc[-1])
        latest_sma = float(sma.iloc[-1])
        latest_std = float(std.iloc[-1])

        if pd.isna(latest_sma) or latest_std is None or latest_std < 1e-8:
            return None

        z = (latest_close - latest_sma) / latest_std
        ts = bars.index[-1]

        long_sma = close.rolling(self.trend_filter_lookback).mean()
        long_trend = float(close.iloc[-1] / long_sma.iloc[-1] - 1) if not pd.isna(long_sma.iloc[-1]) else 0.0

        vol_ok = True
        if self.require_volume_confirm and volume is not None:
            avg_vol = volume.rolling(self.lookback).mean().iloc[-1]
            vol_ok = float(volume.iloc[-1]) > float(avg_vol) * 0.8

        if z <= -self.z_entry and vol_ok and long_trend > -0.08:
            strength = min(1.0, abs(z) / (self.z_entry * 2))
            return Signal(
                symbol=symbol,
                signal="buy",
                strength=strength,
                reason=f"Mean-reversion BUY: z={z:.2f} (oversold vs {self.lookback}d SMA)",
                price=latest_close,
                timestamp=ts,
            )

        if z >= self.z_entry and vol_ok and long_trend < 0.08:
            strength = min(1.0, abs(z) / (self.z_entry * 2))
            return Signal(
                symbol=symbol,
                signal="sell",
                strength=strength,
                reason=f"Mean-reversion SELL: z={z:.2f} (overbought vs {self.lookback}d SMA)",
                price=latest_close,
                timestamp=ts,
            )

        if abs(z) <= self.z_exit:
            return Signal(
                symbol=symbol,
                signal="hold",
                strength=0.0,
                reason=f"Near mean (z={z:.2f})",
                price=latest_close,
                timestamp=ts,
            )

        return Signal(
            symbol=symbol,
            signal="hold",
            strength=0.0,
            reason=f"No extreme (z={z:.2f})",
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
