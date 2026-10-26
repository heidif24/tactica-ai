"""Market data module – historical and current prices via Alpaca."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
from loguru import logger

from src.utils.helpers import get_env


class MarketDataClient:
    """Fetch and cache market data. Prefers Alpaca; falls back gracefully."""

    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        api_key = get_env("ALPACA_API_KEY")
        secret_key = get_env("ALPACA_SECRET_KEY")
        if not api_key or not secret_key or api_key.startswith("your_"):
            logger.warning("Alpaca keys not configured. Market data will use simulated fallback.")
            self._client = None
            return
        try:
            from alpaca.data.historical import StockHistoricalDataClient
            self._client = StockHistoricalDataClient(api_key, secret_key)
            logger.info("Alpaca historical data client ready.")
        except Exception as e:
            logger.error(f"Failed to init Alpaca data client: {e}")
            self._client = None

    def get_bars(
        self,
        symbol: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        timeframe: str = "1Day",
        limit: int = 500,
    ) -> pd.DataFrame:
        """Return OHLCV bars as a clean DataFrame indexed by timestamp."""
        if end is None:
            end = datetime.utcnow()
        if start is None:
            start = end - timedelta(days=400)

        cache_key = f"{symbol}_{timeframe}_{start.date()}_{end.date()}.parquet"
        cache_path = self.cache_dir / cache_key
        if cache_path.exists():
            try:
                df = pd.read_parquet(cache_path)
                logger.debug(f"Cache hit for {symbol}")
                return df
            except Exception:
                pass

        if self._client is None:
            return self._simulate_bars(symbol, start, end)

        try:
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame

            tf_map = {
                "1Day": TimeFrame.Day,
                "1Hour": TimeFrame.Hour,
                "15Min": TimeFrame.Minute,
            }
            tf = tf_map.get(timeframe, TimeFrame.Day)

            request = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=tf,
                start=start,
                end=end,
                limit=limit,
            )
            bars = self._client.get_stock_bars(request)
            df = bars.df
            if isinstance(df.index, pd.MultiIndex):
                df = df.xs(symbol, level=0)
            df = df.rename(columns=str.lower)
            df.index = pd.to_datetime(df.index)
            df = df[["open", "high", "low", "close", "volume"]].dropna()
            df.to_parquet(cache_path)
            return df
        except Exception as e:
            logger.warning(f"Alpaca bars failed for {symbol}: {e}. Using simulation.")
            return self._simulate_bars(symbol, start, end)

    def _simulate_bars(self, symbol: str, start: datetime, end: datetime) -> pd.DataFrame:
        """Generate realistic random-walk bars for offline development / demos."""
        import numpy as np

        dates = pd.bdate_range(start=start, end=end)
        n = len(dates)
        if n == 0:
            return pd.DataFrame()

        rng = np.random.default_rng(abs(hash(symbol)) % (2**32))
        returns = rng.normal(0.0004, 0.015, n)
        prices = 100 * np.cumprod(1 + returns)
        high = prices * (1 + rng.uniform(0, 0.01, n))
        low = prices * (1 - rng.uniform(0, 0.01, n))
        open_ = prices * (1 + rng.normal(0, 0.003, n))
        volume = rng.integers(1_000_000, 10_000_000, n)

        df = pd.DataFrame(
            {
                "open": open_,
                "high": high,
                "low": low,
                "close": prices,
                "volume": volume,
            },
            index=dates,
        )
        df.index.name = "timestamp"
        return df

    def get_latest_price(self, symbol: str) -> float | None:
        """Return the most recent close price."""
        df = self.get_bars(symbol, start=datetime.utcnow() - timedelta(days=10))
        if df.empty:
            return None
        return float(df["close"].iloc[-1])
