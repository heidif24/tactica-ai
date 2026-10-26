"""Simple event-driven backtester with realistic cost assumptions."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from loguru import logger

from src.signals.momentum import MomentumSignal
from src.risk.risk_manager import RiskManager, Position


@dataclass
class Trade:
    symbol: str
    side: str
    qty: float
    price: float
    timestamp: datetime
    pnl: float = 0.0


@dataclass
class BacktestResult:
    equity_curve: pd.Series
    trades: List[Trade]
    metrics: dict
    config: dict


class Backtester:
    def __init__(self, config: dict):
        self.config = config
        bt = config.get("backtest", {})
        self.initial_capital = float(bt.get("initial_capital", 100.0))
        self.slippage_bps = float(config.get("execution", {}).get("slippage_bps", 5))
        self.commission = float(config.get("execution", {}).get("commission_per_trade", 0.0))
        self.benchmark = bt.get("benchmark", "SPY")

        strat = config.get("strategy", {})
        self.signal_gen = MomentumSignal(
            lookback=int(strat.get("lookback_days", 20)),
            threshold=float(strat.get("momentum_threshold", 0.02)),
            holding_period=int(strat.get("holding_period_days", 5)),
        )
        self.risk = RiskManager(config)

    def run(self, data: Dict[str, pd.DataFrame]) -> BacktestResult:
        if not data:
            raise ValueError("No data provided")

        common_idx = None
        for df in data.values():
            idx = df.index
            common_idx = idx if common_idx is None else common_idx.intersection(idx)
        common_idx = sorted(common_idx)
        if len(common_idx) < 50:
            raise ValueError("Insufficient overlapping history")

        cash = self.initial_capital
        positions: Dict[str, Position] = {}
        equity_points = []
        trades: List[Trade] = []
        entry_dates: Dict[str, datetime] = {}

        for i, ts in enumerate(common_idx):
            for sym, pos in list(positions.items()):
                if ts in data[sym].index:
                    pos.current_price = float(data[sym].loc[ts, "close"])

            equity = cash + sum(p.market_value for p in positions.values())
            self.risk.update_state(cash, equity, positions)
            equity_points.append({"timestamp": ts, "equity": equity, "cash": cash})

            window_data = {
                sym: df.loc[:ts].tail(60)
                for sym, df in data.items()
                if len(df.loc[:ts]) > 30
            }
            signals = self.signal_gen.batch(window_data)

            for sig in signals:
                price = sig.price
                slip = price * (self.slippage_bps / 10_000)
                fill_price = price + slip if sig.signal == "buy" else price - slip

                if sig.signal == "buy" and sig.symbol not in positions:
                    target_notional = min(
                        equity * self.risk.max_position_pct,
                        cash * 0.9,
                    )
                    if target_notional < 1.0:
                        continue
                    qty = target_notional / fill_price
                    decision = self.risk.check_order(sig.symbol, "buy", qty, fill_price)
                    if not decision.allowed:
                        continue
                    qty = decision.suggested_qty
                    cost = qty * fill_price + self.commission
                    if cost > cash:
                        continue
                    cash -= cost
                    positions[sig.symbol] = Position(sig.symbol, qty, fill_price, fill_price)
                    entry_dates[sig.symbol] = ts
                    trades.append(Trade(sig.symbol, "buy", qty, fill_price, ts))

                elif sig.signal == "sell" and sig.symbol in positions:
                    pos = positions[sig.symbol]
                    proceeds = pos.qty * fill_price - self.commission
                    pnl = (fill_price - pos.avg_entry) * pos.qty
                    cash += proceeds
                    trades.append(Trade(sig.symbol, "sell", pos.qty, fill_price, ts, pnl=pnl))
                    del positions[sig.symbol]
                    entry_dates.pop(sig.symbol, None)

            hold_days = self.signal_gen.holding_period
            for sym in list(positions.keys()):
                if sym in entry_dates:
                    days_held = (ts - entry_dates[sym]).days
                    if days_held >= hold_days:
                        pos = positions[sym]
                        price = pos.current_price
                        slip = price * (self.slippage_bps / 10_000)
                        fill_price = price - slip
                        proceeds = pos.qty * fill_price - self.commission
                        pnl = (fill_price - pos.avg_entry) * pos.qty
                        cash += proceeds
                        trades.append(Trade(sym, "sell", pos.qty, fill_price, ts, pnl=pnl))
                        del positions[sym]
                        entry_dates.pop(sym, None)

        final_equity = cash + sum(p.market_value for p in positions.values())
        equity_df = pd.DataFrame(equity_points).set_index("timestamp")
        equity_series = equity_df["equity"]

        metrics = self._compute_metrics(equity_series, trades, data.get(self.benchmark))
        logger.info(f"Backtest finished. Final equity: ${final_equity:.2f} | Trades: {len(trades)}")
        return BacktestResult(
            equity_curve=equity_series,
            trades=trades,
            metrics=metrics,
            config=self.config,
        )

    def _compute_metrics(
        self,
        equity: pd.Series,
        trades: List[Trade],
        benchmark_bars: Optional[pd.DataFrame],
    ) -> dict:
        if equity.empty:
            return {}

        rets = equity.pct_change().dropna()
        total_return = equity.iloc[-1] / equity.iloc[0] - 1
        days = (equity.index[-1] - equity.index[0]).days or 1
        ann_factor = 252 / max(days, 1)
        sharpe = (rets.mean() / rets.std() * np.sqrt(252)) if rets.std() > 0 else 0.0
        max_dd = ((equity / equity.cummax()) - 1).min()

        wins = [t for t in trades if t.side == "sell" and t.pnl > 0]
        losses = [t for t in trades if t.side == "sell" and t.pnl <= 0]
        win_rate = len(wins) / max(len(wins) + len(losses), 1)

        bench_ret = None
        if benchmark_bars is not None and not benchmark_bars.empty:
            b = benchmark_bars["close"].reindex(equity.index).ffill()
            if len(b) > 1:
                bench_ret = b.iloc[-1] / b.iloc[0] - 1

        return {
            "total_return_pct": round(total_return * 100, 2),
            "annualized_return_pct": round(total_return * ann_factor * 100, 2),
            "sharpe_ratio": round(float(sharpe), 2),
            "max_drawdown_pct": round(float(max_dd) * 100, 2),
            "num_trades": len([t for t in trades if t.side == "sell"]),
            "win_rate_pct": round(win_rate * 100, 1),
            "final_equity": round(float(equity.iloc[-1]), 2),
            "benchmark_return_pct": round(bench_ret * 100, 2) if bench_ret is not None else None,
        }
