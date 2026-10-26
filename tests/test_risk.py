"""Basic risk manager tests."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.risk.risk_manager import RiskManager, Position


def test_hard_capital_ceiling():
    cfg = {
        "risk": {
            "max_total_capital": 100.0,
            "max_position_pct": 0.2,
            "max_portfolio_exposure": 0.8,
            "max_daily_loss_pct": 0.03,
            "max_drawdown_pct": 0.10,
            "min_cash_reserve_pct": 0.15,
            "max_open_positions": 5,
            "allow_shorting": False,
        }
    }
    rm = RiskManager(cfg)
    assert rm.max_total_capital == 100.0

    # Should reject oversized position
    decision = rm.check_order("AAPL", "buy", qty=50, price=200)  # $10k notional
    assert decision.allowed is False


def test_trading_halt_on_drawdown():
    cfg = {"risk": {"max_total_capital": 100.0, "max_drawdown_pct": 0.10}}
    rm = RiskManager(cfg)
    rm.update_state(cash=80, equity=80, positions={})
    # Force peak high so drawdown triggers
    rm.state.peak_equity = 100
    rm.update_state(cash=80, equity=80, positions={})
    assert rm.state.trading_halted is True
    decision = rm.check_order("SPY", "buy", 1, 400)
    assert decision.allowed is False
