"""
High-level momentum strategy that wires signal + prediction + risk together.
Used by both the dashboard and any future scheduled runner.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import pandas as pd
from loguru import logger

from src.signals.momentum import MomentumSignal, Signal
from src.prediction.simple_predictor import SimplePredictor, Prediction
from src.risk.risk_manager import RiskManager, RiskDecision
from src.execution.alpaca_executor import SimulatedExecutor, Order


class MomentumStrategy:
    def __init__(self, config: dict, risk: RiskManager, executor: SimulatedExecutor):
        strat = config.get("strategy", {})
        pred = config.get("prediction", {})
        self.signal_gen = MomentumSignal(
            lookback=int(strat.get("lookback_days", 20)),
            threshold=float(strat.get("momentum_threshold", 0.02)),
            holding_period=int(strat.get("holding_period_days", 5)),
        )
        self.predictor = SimplePredictor(
            horizon_days=int(pred.get("horizon_days", 5)),
            min_prob=float(pred.get("min_probability", 0.55)),
        )
        self.risk = risk
        self.executor = executor
        self.max_position_pct = float(config.get("risk", {}).get("max_position_pct", 0.20))

    def evaluate(self, data: Dict[str, pd.DataFrame]) -> List[dict]:
        """Generate candidate actions for the current bar."""
        signals = self.signal_gen.batch(data)
        actions = []
        for sig in signals:
            pred = self.predictor.predict(sig.symbol, data[sig.symbol])
            if sig.signal == "buy":
                if pred and not self.predictor.should_act(pred):
                    logger.debug(f"Skipping {sig.symbol}: probability too low or high uncertainty")
                    continue
                actions.append({
                    "symbol": sig.symbol,
                    "side": "buy",
                    "signal": sig,
                    "prediction": pred,
                })
            elif sig.signal == "sell":
                actions.append({
                    "symbol": sig.symbol,
                    "side": "sell",
                    "signal": sig,
                    "prediction": pred,
                })
        return actions

    def execute_actions(self, actions: List[dict], prices: Dict[str, float]) -> List[Order]:
        orders = []
        equity = self.risk.state.equity
        for act in actions:
            symbol = act["symbol"]
            side = act["side"]
            price = prices.get(symbol) or act["signal"].price
            if side == "buy":
                target_notional = equity * self.max_position_pct * act["signal"].strength
                qty = target_notional / price
            else:
                pos = self.risk.state.positions.get(symbol)
                qty = pos.qty if pos else 0.0
            if qty <= 0:
                continue
            order = self.executor.submit_order(symbol, side, qty, price)
            orders.append(order)
        return orders
