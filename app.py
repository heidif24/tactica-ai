"""
Tactica AI – Streamlit Dashboard
Run with:  streamlit run app.py
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# Ensure project root is on path
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from src.utils.helpers import load_config, setup_logging
from src.data.market_data import MarketDataClient
from src.signals.momentum import MomentumSignal
from src.prediction.simple_predictor import SimplePredictor
from src.risk.risk_manager import RiskManager
from src.execution.alpaca_executor import SimulatedExecutor, AlpacaExecutor
from src.backtest.backtester import Backtester

# -----------------------------------------------------------------------------
# Page setup
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="Tactica AI",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

setup_logging()
config = load_config(ROOT / "config.yaml")


@st.cache_resource
def get_data_client():
    return MarketDataClient(cache_dir=str(ROOT / "data" / "cache"))


@st.cache_resource
def get_risk_manager():
    return RiskManager(config)


def main():
    st.title("📈 Tactica AI – Trading Lab")
    st.caption(
        "Paper-trading focused · Strict risk limits · $100 capital ceiling · "
        "Evidence before live capital"
    )

    # Sidebar
    with st.sidebar:
        st.header("Controls")
        mode = st.radio("Mode", ["Dashboard", "Backtest", "Live Paper (Alpaca)"], index=0)
        symbols = st.multiselect(
            "Universe",
            options=config["universe"]["default_symbols"],
            default=config["universe"]["default_symbols"][:5],
        )
        st.divider()
        st.subheader("Risk Limits (hard)")
        st.json({
            "max_capital": config["risk"]["max_total_capital"],
            "max_position_pct": config["risk"]["max_position_pct"],
            "max_drawdown_pct": config["risk"]["max_drawdown_pct"],
            "max_daily_loss_pct": config["risk"]["max_daily_loss_pct"],
        })
        st.info("Risk module cannot be overridden by signals or AI.")

    data_client = get_data_client()
    risk = get_risk_manager()

    if mode == "Dashboard":
        render_dashboard(data_client, risk, symbols)
    elif mode == "Backtest":
        render_backtest(data_client, symbols)
    else:
        render_live_paper(data_client, risk, symbols)


def render_dashboard(data_client: MarketDataClient, risk: RiskManager, symbols: list[str]):
    st.header("Market Overview & Signals")

    col1, col2, col3, col4 = st.columns(4)
    status = risk.status_report()
    col1.metric("Equity", f"${status['equity']:.2f}")
    col2.metric("Cash", f"${status['cash']:.2f}")
    col3.metric("Exposure", f"{status['exposure_pct']:.1f}%")
    col4.metric("Drawdown", f"{status['drawdown_pct']:.1f}%",
                delta_color="inverse")

    if status["trading_halted"]:
        st.error("⛔ TRADING HALTED by risk controls")

    signal_gen = MomentumSignal(
        lookback=config["strategy"]["lookback_days"],
        threshold=config["strategy"]["momentum_threshold"],
    )
    predictor = SimplePredictor(
        horizon_days=config["prediction"]["horizon_days"],
        min_prob=config["prediction"]["min_probability"],
    )

    rows = []
    price_data = {}
    for sym in symbols:
        with st.spinner(f"Loading {sym}..."):
            bars = data_client.get_bars(sym)
            price_data[sym] = bars
            sig = signal_gen.generate(sym, bars)
            pred = predictor.predict(sym, bars)
            latest = float(bars["close"].iloc[-1]) if not bars.empty else None
            rows.append({
                "Symbol": sym,
                "Price": latest,
                "Signal": sig.signal.upper() if sig else "—",
                "Strength": f"{sig.strength:.2f}" if sig else "—",
                "P(up)": f"{pred.probability_up:.1%}" if pred else "—",
                "Reason": sig.reason if sig else "",
            })

    st.subheader("Current Signals")
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    st.subheader("Price History")
    selected = st.selectbox("Chart symbol", symbols)
    if selected and selected in price_data and not price_data[selected].empty:
        df = price_data[selected].tail(120)
        fig = go.Figure(data=[
            go.Candlestick(
                x=df.index,
                open=df["open"],
                high=df["high"],
                low=df["low"],
                close=df["close"],
                name=selected,
            )
        ])
        fig.update_layout(
            title=f"{selected} – Last 120 sessions",
            xaxis_rangeslider_visible=False,
            height=420,
            template="plotly_dark",
        )
        st.plotly_chart(fig, use_container_width=True)


def render_backtest(data_client: MarketDataClient, symbols: list[str]):
    st.header("Strategy Backtest")
    st.markdown(
        "Runs the momentum strategy on historical data with realistic slippage "
        "and the same risk limits. This is the first evidence gate."
    )

    col_a, col_b = st.columns(2)
    start = col_a.date_input("Start", value=datetime(2023, 1, 1))
    end = col_b.date_input("End", value=datetime.utcnow().date())

    if st.button("Run Backtest", type="primary"):
        with st.spinner("Fetching data and running simulation..."):
            data = {}
            for sym in symbols:
                bars = data_client.get_bars(
                    sym,
                    start=datetime.combine(start, datetime.min.time()),
                    end=datetime.combine(end, datetime.min.time()),
                )
                if not bars.empty:
                    data[sym] = bars

            if not data:
                st.error("No data returned. Check symbols or API keys.")
                return

            bt = Backtester(config)
            result = bt.run(data)

        st.success("Backtest complete")
        m = result.metrics
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Return", f"{m.get('total_return_pct', 0):.1f}%")
        c2.metric("Max Drawdown", f"{m.get('max_drawdown_pct', 0):.1f}%")
        c3.metric("Sharpe", f"{m.get('sharpe_ratio', 0):.2f}")
        c4.metric("Win Rate", f"{m.get('win_rate_pct', 0):.1f}%")

        if m.get("benchmark_return_pct") is not None:
            st.info(f"Benchmark ({config['backtest']['benchmark']}) return: {m['benchmark_return_pct']:.1f}%")

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=result.equity_curve.index,
            y=result.equity_curve.values,
            mode="lines",
            name="Strategy Equity",
            line=dict(color="#00cc96"),
        ))
        fig.update_layout(
            title="Equity Curve ($100 start)",
            height=400,
            template="plotly_dark",
            yaxis_title="Equity ($)",
        )
        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Trade Log (last 20)")
        trade_df = pd.DataFrame([
            {
                "Time": t.timestamp,
                "Symbol": t.symbol,
                "Side": t.side.upper(),
                "Qty": round(t.qty, 4),
                "Price": round(t.price, 2),
                "PnL": round(t.pnl, 2),
            }
            for t in result.trades[-20:]
        ])
        st.dataframe(trade_df, use_container_width=True, hide_index=True)


def render_live_paper(data_client: MarketDataClient, risk: RiskManager, symbols: list[str]):
    st.header("Paper Trading (Alpaca or Local Simulation)")
    st.warning(
        "This mode places **paper** orders only. Live capital is disabled until "
        "you explicitly change configuration and accept the risk of loss."
    )

    use_alpaca = st.checkbox("Use Alpaca paper account (requires API keys in .env)", value=False)

    if "sim_executor" not in st.session_state:
        st.session_state.sim_executor = SimulatedExecutor(risk, initial_cash=config["risk"]["max_total_capital"])

    executor = st.session_state.sim_executor
    if use_alpaca:
        alpaca = AlpacaExecutor(risk)
        if alpaca.is_live_paper:
            st.success("Connected to Alpaca paper trading.")
            acct = alpaca.get_account()
            st.json(acct)
        else:
            st.error("Alpaca keys not found or invalid. Falling back to local simulation.")
            use_alpaca = False

    st.subheader("Manual Order Ticket (risk-checked)")
    c1, c2, c3, c4 = st.columns(4)
    sym = c1.selectbox("Symbol", symbols)
    side = c2.selectbox("Side", ["buy", "sell"])
    qty = c3.number_input("Qty", min_value=0.001, value=1.0, step=0.1)
    if c4.button("Submit"):
        price = data_client.get_latest_price(sym) or 100.0
        if use_alpaca and alpaca.is_live_paper:
            order = alpaca.submit_order(sym, side, qty, price)
        else:
            order = executor.submit_order(sym, side, qty, price)
        if order.status == "filled":
            st.success(f"Filled {order.side} {order.filled_qty} {order.symbol} @ {order.filled_avg_price}")
        else:
            st.error(f"Rejected / Error: {order.message}")

    st.subheader("Account Snapshot")
    st.json(executor.get_account() if not use_alpaca else alpaca.get_account())
    st.json(risk.status_report())


if __name__ == "__main__":
    main()
