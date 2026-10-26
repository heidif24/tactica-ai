"""Order execution – paper trading via Alpaca + pure simulation fallback."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from loguru import logger

from src.risk.risk_manager import Position, RiskManager
from src.utils.helpers import get_env


@dataclass
class Order:
    id: str
    symbol: str
    side: str
    qty: float
    order_type: str
    status: str
    filled_qty: float = 0.0
    filled_avg_price: float = 0.0
    submitted_at: datetime = field(default_factory=datetime.utcnow)
    filled_at: Optional[datetime] = None
    message: str = ""


class SimulatedExecutor:
    """Local paper-trading engine that never touches a real broker."""

    def __init__(self, risk_manager: RiskManager, initial_cash: float = 100.0):
        self.risk = risk_manager
        self.cash = initial_cash
        self.positions: Dict[str, Position] = {}
        self.orders: List[Order] = []
        self.equity_curve: List[dict] = []
        self._sync_risk()

    def _sync_risk(self) -> None:
        equity = self.cash + sum(p.market_value for p in self.positions.values())
        self.risk.update_state(self.cash, equity, self.positions)

    def submit_order(
        self,
        symbol: str,
        side: str,
        qty: float,
        price: float,
        order_type: str = "market",
    ) -> Order:
        decision = self.risk.check_order(symbol, side, qty, price)
        order_id = str(uuid4())[:8]

        if not decision.allowed:
            order = Order(
                id=order_id,
                symbol=symbol,
                side=side,
                qty=qty,
                order_type=order_type,
                status="rejected",
                message=decision.reason,
            )
            self.orders.append(order)
            logger.warning(f"Order rejected: {decision.reason}")
            return order

        qty = decision.suggested_qty
        notional = qty * price

        if side.lower() == "buy":
            if notional > self.cash:
                order = Order(
                    id=order_id, symbol=symbol, side=side, qty=qty,
                    order_type=order_type, status="rejected",
                    message="Insufficient cash",
                )
                self.orders.append(order)
                return order
            self.cash -= notional
            if symbol in self.positions:
                pos = self.positions[symbol]
                total_qty = pos.qty + qty
                pos.avg_entry = (pos.avg_entry * pos.qty + price * qty) / total_qty
                pos.qty = total_qty
                pos.current_price = price
            else:
                self.positions[symbol] = Position(symbol, qty, price, price, "long")
        else:
            if symbol not in self.positions or self.positions[symbol].qty < qty:
                order = Order(
                    id=order_id, symbol=symbol, side=side, qty=qty,
                    order_type=order_type, status="rejected",
                    message="Insufficient position",
                )
                self.orders.append(order)
                return order
            pos = self.positions[symbol]
            self.cash += qty * price
            pos.qty -= qty
            if pos.qty <= 1e-8:
                del self.positions[symbol]
            else:
                pos.current_price = price

        order = Order(
            id=order_id,
            symbol=symbol,
            side=side,
            qty=qty,
            order_type=order_type,
            status="filled",
            filled_qty=qty,
            filled_avg_price=price,
            filled_at=datetime.utcnow(),
            message="Simulated fill",
        )
        self.orders.append(order)
        self._sync_risk()
        self.equity_curve.append(
            {
                "timestamp": datetime.utcnow().isoformat(),
                "equity": self.risk.state.equity,
                "cash": self.cash,
            }
        )
        logger.info(f"FILLED {side.upper()} {qty:.4f} {symbol} @ {price:.2f}")
        return order

    def update_prices(self, prices: Dict[str, float]) -> None:
        for symbol, price in prices.items():
            if symbol in self.positions:
                self.positions[symbol].current_price = price
        self._sync_risk()

    def get_account(self) -> dict:
        self._sync_risk()
        return {
            "cash": round(self.cash, 2),
            "equity": round(self.risk.state.equity, 2),
            "buying_power": round(self.cash, 2),
            "positions": len(self.positions),
        }


class AlpacaExecutor:
    """Real Alpaca paper-trading client. Falls back to simulation if keys missing."""

    def __init__(self, risk_manager: RiskManager):
        self.risk = risk_manager
        self._client = None
        self._init()

    def _init(self) -> None:
        api_key = get_env("ALPACA_API_KEY")
        secret = get_env("ALPACA_SECRET_KEY")
        if not api_key or not secret or api_key.startswith("your_"):
            logger.warning("No valid Alpaca keys – AlpacaExecutor will not place real paper orders.")
            return
        try:
            from alpaca.trading.client import TradingClient
            self._client = TradingClient(api_key, secret, paper=True)
            logger.info("Alpaca paper TradingClient ready.")
        except Exception as e:
            logger.error(f"Alpaca client init failed: {e}")

    @property
    def is_live_paper(self) -> bool:
        return self._client is not None

    def get_account(self) -> dict:
        if not self._client:
            return {"error": "Alpaca client not configured (missing or invalid keys)"}
        try:
            acct = self._client.get_account()
            return {
                "cash": float(acct.cash),
                "equity": float(acct.equity),
                "buying_power": float(acct.buying_power),
                "status": str(acct.status),
            }
        except Exception as e:
            logger.error(f"Alpaca get_account failed: {e}")
            return {
                "error": str(e),
                "hint": (
                    "Check that your Streamlit secrets use PAPER keys "
                    "(from the Paper Trading dashboard), with no extra quotes or spaces."
                ),
            }

    def submit_order(
        self,
        symbol: str,
        side: str,
        qty: float,
        price: float,
        order_type: str = "market",
    ) -> Order:
        decision = self.risk.check_order(symbol, side, qty, price)
        order_id = str(uuid4())[:8]
        if not decision.allowed:
            return Order(
                id=order_id, symbol=symbol, side=side, qty=qty,
                order_type=order_type, status="rejected", message=decision.reason,
            )

        if not self._client:
            return Order(
                id=order_id, symbol=symbol, side=side, qty=qty,
                order_type=order_type, status="rejected",
                message="Alpaca client not configured",
            )

        try:
            from alpaca.trading.requests import MarketOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce

            side_enum = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            req = MarketOrderRequest(
                symbol=symbol,
                qty=round(decision.suggested_qty, 4),
                side=side_enum,
                time_in_force=TimeInForce.DAY,
            )
            result = self._client.submit_order(req)
            return Order(
                id=str(result.id),
                symbol=symbol,
                side=side,
                qty=float(result.qty),
                order_type="market",
                status=str(result.status),
                filled_qty=float(result.filled_qty or 0),
                filled_avg_price=float(result.filled_avg_price or 0),
                message="Submitted to Alpaca paper",
            )
        except Exception as e:
            logger.error(f"Alpaca order failed: {e}")
            return Order(
                id=order_id, symbol=symbol, side=side, qty=qty,
                order_type=order_type, status="error", message=str(e),
            )
