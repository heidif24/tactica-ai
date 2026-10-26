"""Hard risk controls. The AI / signal modules cannot override this."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Dict, List, Optional

from loguru import logger


@dataclass
class Position:
    symbol: str
    qty: float
    avg_entry: float
    current_price: float
    side: str = "long"

    @property
    def market_value(self) -> float:
        return abs(self.qty) * self.current_price

    @property
    def unrealized_pnl(self) -> float:
        direction = 1 if self.side == "long" else -1
        return direction * self.qty * (self.current_price - self.avg_entry)


@dataclass
class RiskDecision:
    allowed: bool
    reason: str
    suggested_qty: float = 0.0
    max_notional: float = 0.0


@dataclass
class PortfolioState:
    cash: float
    equity: float
    positions: Dict[str, Position] = field(default_factory=dict)
    daily_pnl: float = 0.0
    peak_equity: float = 0.0
    trading_halted: bool = False
    last_update: datetime = field(default_factory=datetime.utcnow)

    @property
    def total_exposure(self) -> float:
        return sum(p.market_value for p in self.positions.values())

    @property
    def exposure_pct(self) -> float:
        if self.equity <= 0:
            return 0.0
        return self.total_exposure / self.equity

    @property
    def drawdown_pct(self) -> float:
        if self.peak_equity <= 0:
            return 0.0
        return max(0.0, (self.peak_equity - self.equity) / self.peak_equity)


class RiskManager:
    """
    Central risk gatekeeper.
    Every proposed trade must pass through check_order().
    The signal / prediction modules have no authority to bypass this.
    """

    def __init__(self, config: dict):
        risk_cfg = config.get("risk", {})
        self.max_total_capital = float(risk_cfg.get("max_total_capital", 100.0))
        self.max_position_pct = float(risk_cfg.get("max_position_pct", 0.20))
        self.max_portfolio_exposure = float(risk_cfg.get("max_portfolio_exposure", 0.80))
        self.max_daily_loss_pct = float(risk_cfg.get("max_daily_loss_pct", 0.03))
        self.max_drawdown_pct = float(risk_cfg.get("max_drawdown_pct", 0.10))
        self.min_cash_reserve_pct = float(risk_cfg.get("min_cash_reserve_pct", 0.15))
        self.max_open_positions = int(risk_cfg.get("max_open_positions", 5))
        self.allow_shorting = bool(risk_cfg.get("allow_shorting", False))

        self.state = PortfolioState(
            cash=self.max_total_capital,
            equity=self.max_total_capital,
            peak_equity=self.max_total_capital,
        )
        self._day_start_equity = self.max_total_capital
        self._current_day: date = datetime.utcnow().date()

    def update_state(
        self,
        cash: float,
        equity: float,
        positions: Dict[str, Position],
        daily_pnl: Optional[float] = None,
    ) -> None:
        """Sync with broker or simulation state."""
        today = datetime.utcnow().date()
        if today != self._current_day:
            self._day_start_equity = equity
            self._current_day = today

        self.state.cash = cash
        self.state.equity = min(equity, self.max_total_capital)
        self.state.positions = positions
        self.state.peak_equity = max(self.state.peak_equity, equity)
        if daily_pnl is not None:
            self.state.daily_pnl = daily_pnl
        else:
            self.state.daily_pnl = equity - self._day_start_equity
        self.state.last_update = datetime.utcnow()

        if self.state.drawdown_pct >= self.max_drawdown_pct:
            self.state.trading_halted = True
            logger.warning(f"TRADING HALTED: drawdown {self.state.drawdown_pct:.2%} >= limit")
        if self.state.daily_pnl < 0 and abs(self.state.daily_pnl) / max(self._day_start_equity, 1) >= self.max_daily_loss_pct:
            self.state.trading_halted = True
            logger.warning("TRADING HALTED: daily loss limit breached")

    def check_order(
        self,
        symbol: str,
        side: str,
        qty: float,
        price: float,
    ) -> RiskDecision:
        if self.state.trading_halted:
            return RiskDecision(False, "Trading is currently halted by risk controls")

        if side.lower() == "sell" and not self.allow_shorting:
            pos = self.state.positions.get(symbol)
            if not pos or pos.qty <= 0:
                return RiskDecision(False, "Shorting disabled and no long position to close")

        notional = abs(qty) * price
        if notional < 1.0:
            return RiskDecision(False, "Order notional too small")

        max_pos_value = self.state.equity * self.max_position_pct
        if symbol in self.state.positions:
            current_value = self.state.positions[symbol].market_value
            if side.lower() == "buy" and current_value + notional > max_pos_value:
                allowed_notional = max(0.0, max_pos_value - current_value)
                if allowed_notional < 1.0:
                    return RiskDecision(False, f"Would exceed max position size ({self.max_position_pct:.0%})")
                qty = allowed_notional / price
                notional = allowed_notional

        new_exposure = self.state.total_exposure + (notional if side.lower() == "buy" else -notional)
        if new_exposure / max(self.state.equity, 1) > self.max_portfolio_exposure:
            return RiskDecision(False, f"Would exceed max portfolio exposure ({self.max_portfolio_exposure:.0%})")

        if side.lower() == "buy":
            cash_after = self.state.cash - notional
            if cash_after / max(self.state.equity, 1) < self.min_cash_reserve_pct:
                return RiskDecision(False, f"Would breach minimum cash reserve ({self.min_cash_reserve_pct:.0%})")

        if side.lower() == "buy" and symbol not in self.state.positions:
            if len(self.state.positions) >= self.max_open_positions:
                return RiskDecision(False, f"Max open positions ({self.max_open_positions}) reached")

        if self.state.equity > self.max_total_capital:
            return RiskDecision(False, "Portfolio already at or above capital ceiling")

        return RiskDecision(
            allowed=True,
            reason="OK",
            suggested_qty=round(qty, 4),
            max_notional=notional,
        )

    def status_report(self) -> dict:
        return {
            "cash": round(self.state.cash, 2),
            "equity": round(self.state.equity, 2),
            "exposure_pct": round(self.state.exposure_pct * 100, 2),
            "drawdown_pct": round(self.state.drawdown_pct * 100, 2),
            "daily_pnl": round(self.state.daily_pnl, 2),
            "open_positions": len(self.state.positions),
            "trading_halted": self.state.trading_halted,
            "max_capital": self.max_total_capital,
            "positions": {
                s: {
                    "qty": p.qty,
                    "value": round(p.market_value, 2),
                    "pnl": round(p.unrealized_pnl, 2),
                }
                for s, p in self.state.positions.items()
            },
        }
