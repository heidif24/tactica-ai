#!/usr/bin/env python3
"""
Tactica AI – Autonomous Trading Runner

Runs the strategy in a continuous loop (every 1 or 5 minutes).
Respects all hard risk limits. Stops automatically on daily loss / drawdown.

Usage:
    python run_autonomous.py                  # local simulation, 5-min interval
    python run_autonomous.py --interval 60     # every 60 seconds
    python run_autonomous.py --alpaca          # use Alpaca paper account
    python run_autonomous.py --symbols SPY,QQQ,AAPL
"""

from __future__ import annotations

import argparse
import signal
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from loguru import logger

from src.utils.helpers import load_config, setup_logging
from src.data.market_data import MarketDataClient
from src.risk.risk_manager import RiskManager
from src.execution.alpaca_executor import SimulatedExecutor, AlpacaExecutor
from strategies.momentum_strategy import MomentumStrategy


class AutonomousRunner:
    def __init__(
        self,
        config: dict,
        interval_seconds: int = 300,
        use_alpaca: bool = False,
        symbols: list[str] | None = None,
    ):
        self.config = config
        self.interval = max(30, interval_seconds)  # safety floor 30s
        self.symbols = symbols or config["universe"]["default_symbols"][:6]
        self.running = True

        setup_logging()
        self.data = MarketDataClient(cache_dir=str(ROOT / "data" / "cache"))
        self.risk = RiskManager(config)

        if use_alpaca:
            self.executor = AlpacaExecutor(self.risk)
            if not self.executor.is_live_paper:
                logger.warning("Alpaca keys missing – falling back to local simulation")
                self.executor = SimulatedExecutor(
                    self.risk, initial_cash=config["risk"]["max_total_capital"]
                )
        else:
            self.executor = SimulatedExecutor(
                self.risk, initial_cash=config["risk"]["max_total_capital"]
            )

        self.strategy = MomentumStrategy(config, self.risk, self.executor)

        # Graceful shutdown
        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

    def _shutdown(self, signum, frame):
        logger.info("Shutdown signal received – stopping after current cycle")
        self.running = False

    def _is_market_hours(self) -> bool:
        """Simple US equity market hours check (approx, ignores holidays)."""
        now = datetime.utcnow()
        if now.weekday() >= 5:
            return False
        minutes = now.hour * 60 + now.minute
        return 13 * 60 + 30 <= minutes <= 20 * 60

    def run_once(self) -> None:
        """Single evaluation + execution cycle."""
        if self.risk.state.trading_halted:
            logger.warning("Trading halted by risk controls – skipping cycle")
            return

        data = {}
        prices = {}
        for sym in self.symbols:
            try:
                bars = self.data.get_bars(sym)
                if not bars.empty:
                    data[sym] = bars
                    prices[sym] = float(bars["close"].iloc[-1])
            except Exception as e:
                logger.error(f"Data fetch failed for {sym}: {e}")

        if not data:
            logger.warning("No market data available this cycle")
            return

        if isinstance(self.executor, SimulatedExecutor):
            self.executor.update_prices(prices)

        actions = self.strategy.evaluate(data)
        if actions:
            logger.info(f"Generated {len(actions)} candidate actions")
            orders = self.strategy.execute_actions(actions, prices)
            for o in orders:
                if o.status == "filled":
                    logger.info(f"  → FILLED {o.side.upper()} {o.filled_qty} {o.symbol} @ {o.filled_avg_price}")
                else:
                    logger.info(f"  → {o.status.upper()}: {o.message}")
        else:
            logger.debug("No actionable signals this cycle")

        status = self.risk.status_report()
        logger.info(
            f"Equity ${status['equity']:.2f} | Cash ${status['cash']:.2f} | "
            f"Exposure {status['exposure_pct']:.1f}% | DD {status['drawdown_pct']:.1f}% | "
            f"Daily PnL ${status['daily_pnl']:.2f}"
        )

    def run(self) -> None:
        logger.info("=" * 60)
        logger.info("Tactica AI Autonomous Runner started")
        logger.info(f"Interval: {self.interval}s | Symbols: {', '.join(self.symbols)}")
        logger.info(f"Max capital: ${self.config['risk']['max_total_capital']}")
        logger.info("Press Ctrl+C to stop gracefully")
        logger.info("=" * 60)

        while self.running:
            try:
                self.run_once()
            except Exception as e:
                logger.exception(f"Cycle error: {e}")

            if not self.running:
                break

            slept = 0
            while slept < self.interval and self.running:
                time.sleep(min(5, self.interval - slept))
                slept += 5

        logger.info("Runner stopped. Final status:")
        logger.info(self.risk.status_report())


def main():
    parser = argparse.ArgumentParser(description="Tactica AI Autonomous Runner")
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Seconds between cycles (default 300 = 5 min). Min 30.",
    )
    parser.add_argument(
        "--alpaca",
        action="store_true",
        help="Use Alpaca paper trading (requires keys in .env)",
    )
    parser.add_argument(
        "--symbols",
        type=str,
        default=None,
        help="Comma-separated symbols, e.g. SPY,QQQ,AAPL",
    )
    args = parser.parse_args()

    config = load_config(ROOT / "config.yaml")
    symbols = args.symbols.split(",") if args.symbols else None

    runner = AutonomousRunner(
        config=config,
        interval_seconds=args.interval,
        use_alpaca=args.alpaca,
        symbols=symbols,
    )
    runner.run()


if __name__ == "__main__":
    main()
