"""Lightweight probability estimator for positive forward return."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
from loguru import logger


@dataclass
class Prediction:
    symbol: str
    probability_up: float      # P(return > 0 over horizon)
    expected_return: float
    uncertainty: float         # higher = less confident
    horizon_days: int
    features_used: list[str]


class SimplePredictor:
    """
    Starts with transparent statistical features (momentum, volatility, RSI-like).
    Can later be swapped for a scikit-learn model without changing the rest of the system.
    """

    def __init__(self, horizon_days: int = 5, min_prob: float = 0.55):
        self.horizon_days = horizon_days
        self.min_prob = min_prob

    def predict(self, symbol: str, bars: pd.DataFrame) -> Optional[Prediction]:
        if bars is None or len(bars) < 40:
            return None

        close = bars["close"].astype(float)
        returns = close.pct_change().dropna()

        # Feature 1: recent momentum
        mom_5 = close.iloc[-1] / close.iloc[-6] - 1 if len(close) > 6 else 0.0
        mom_20 = close.iloc[-1] / close.iloc[-21] - 1 if len(close) > 21 else 0.0

        # Feature 2: realized volatility
        vol = returns.tail(20).std() * np.sqrt(252)

        # Feature 3: simple RSI-style
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))
        latest_rsi = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0

        # Very transparent scoring (not a trained model yet)
        score = 0.0
        score += np.clip(mom_5 * 8, -0.3, 0.3)
        score += np.clip(mom_20 * 3, -0.2, 0.2)
        score += (50 - abs(latest_rsi - 50)) / 200  # prefer mid-range RSI
        score -= min(vol * 0.5, 0.15)               # penalize high vol a little

        # Map score → probability via logistic
        prob = 1 / (1 + np.exp(-score * 4))
        expected = mom_5 * 0.4 + mom_20 * 0.2       # crude expected return
        uncertainty = min(1.0, vol * 2 + abs(latest_rsi - 50) / 100)

        return Prediction(
            symbol=symbol,
            probability_up=float(np.clip(prob, 0.01, 0.99)),
            expected_return=float(expected),
            uncertainty=float(uncertainty),
            horizon_days=self.horizon_days,
            features_used=["mom_5", "mom_20", "volatility", "rsi_14"],
        )

    def should_act(self, pred: Prediction) -> bool:
        return pred.probability_up >= self.min_prob and pred.uncertainty < 0.7
