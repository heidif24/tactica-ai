"""
Tactica AI – Streamlit Dashboard
Run with:  streamlit run app.py
"""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from src.utils.helpers import load_config, setup_logging
from src.data.market_data import MarketDataClient
from src.signals.momentum import MomentumSignal
from src.signals.mean_reversion import MeanReversionSignal
from src.prediction.simple_predictor import SimplePredictor
from src.risk.risk_manager import RiskManager
from src.execution.alpaca_executor import SimulatedExecutor, AlpacaExecutor
from src.backtest.backtester import Backtester

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

    with st.sidebar:
        st.header("Controls")
        mode = st.radio(
            "Mode",
            ["Dashboard", "Backtest", "Live Paper", "Autonomous Control"],
            index=0,
        )
        strategy_choice = st.selectbox(
            "Strategy",
            ["Momentum (trend)", "Mean-Reversion (pendulum)", "Both (conservative)"],
            index=2,
        )
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
        render_dashboard(data_client, risk, symbols, strategy_choice)
    elif mode == "Backtest":
        render_backtest(data_client, symbols)
    elif mode == "Live Paper":
        render_live_paper(data_client, risk, symbols)
    else:
        render_autonomous_control(symbols)


def get_signal_generators(strategy_choice: str):
    gens = []
    if "Momentum" in strategy_choice or "Both" in strategy_choice:
        gens.append(MomentumSignal(
            lookback=config["strategy"]["lookback_days"],
            threshold=config["strategy"]["momentum_threshold"],
        ))
    if "Mean-Reversion" in strategy_choice or "Both" in strategy_choice:
        gens.append(MeanReversionSignal(lookback=20, z_entry=1.8))
    return gens


def render_dashboard(data_client, risk, symbols, strategy_choice):
    st.header("Market Overview & Signals")

    col1, col2, col3, col4 = st.columns(4)
    status = risk.status_report()
    col1.metric("Equity", f"${status['equity']:.2f}")
    col2.metric("Cash", f"${status['cash']:.2f}")
    col3.metric("Exposure", f"{status['exposure_pct']:.1f}%")
    col4.metric("Drawdown", f"{status['drawdown_pct']:.1f}%", delta_color="inverse")

    if status["trading_halted"]:
        st.error("⛔ TRADING HALTED by risk controls")

    gens = get_signal_generators(strategy_choice)
    predictor = SimplePredictor(
        horizon_days=config["prediction"]["horizon_days"],
        min_prob=0.58,
    )

    rows = []
    price_data = {}
    for sym in symbols:
        with st.spinner(f"Loading {sym}..."):
            bars = data_client.get_bars(sym)
            price_data[sym] = bars
            best_sig = None
            for gen in gens:
                sig = gen.generate(sym, bars)
                if sig and sig.signal != "hold":
                    if best_sig is None or sig.strength > best_sig.strength:
                        best_sig = sig
            pred = predictor.predict(sym, bars)
            latest = float(bars["close"].iloc[-1]) if not bars.empty else None
            rows.append({
                "Symbol": sym,
                "Price": latest,
                "Signal": best_sig.signal.upper() if best_sig else "—",
                "Strength": f"{best_sig.strength:.2f}" if best_sig else "—",
                "P(up)": f"{pred.probability_up:.1%}" if pred else "—",
                "Reason": best_sig.reason if best_sig else "",
            })

    st.subheader("Current Signals")
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    st.subheader("Price History")
    selected = st.selectbox("Chart symbol", symbols)
    if selected and selected in price_data and not price_data[selected].empty:
        df = price_data[selected].tail(120)
        fig = go.Figure(data=[
            go.Candlestick(
                x=df.index, open=df["open"], high=df["high"],
                low=df["low"], close=df["close"], name=selected,
            )
        ])
        fig.update_layout(
            title=f"{selected} – Last 120 sessions",
            xaxis_rangeslider_visible=False, height=420, template="plotly_dark",
        )
        st.plotly_chart(fig, use_container_width=True)


def render_backtest(data_client, symbols):
    st.header("Strategy Backtest")
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
                st.error("No data returned.")
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

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=result.equity_curve.index, y=result.equity_curve.values,
            mode="lines", name="Strategy Equity", line=dict(color="#00cc96"),
        ))
        fig.update_layout(title="Equity Curve ($100 start)", height=400, template="plotly_dark")
        st.plotly_chart(fig, use_container_width=True)


def render_live_paper(data_client, risk, symbols):
    st.header("Paper Trading (Alpaca or Local Simulation)")
    st.warning("Paper orders only. Live capital is disabled by design.")
    st.caption(
        "On Streamlit Cloud add secrets as:\n"
        "ALPACA_API_KEY = \"your_paper_key\"\n"
        "ALPACA_SECRET_KEY = \"your_paper_secret\"\n"
        "(Use Paper Trading keys from app.alpaca.markets)"
    )

    use_alpaca = st.checkbox("Use Alpaca paper account", value=False)

    if "sim_executor" not in st.session_state:
        st.session_state.sim_executor = SimulatedExecutor(
            risk, initial_cash=config["risk"]["max_total_capital"]
        )

    executor = st.session_state.sim_executor
    alpaca = None
    account_info = {}

    if use_alpaca:
        alpaca = AlpacaExecutor(risk)
        if alpaca.is_live_paper:
            account_info = alpaca.get_account()
            if "error" in account_info:
                st.error("Alpaca client created but account call failed.")
                st.json(account_info)
                st.info(
                    "Common causes: live keys instead of paper keys, "
                    "extra quotes/spaces in Secrets, or wrong dashboard mode when keys were created."
                )
                use_alpaca = False
            else:
                st.success("Connected to Alpaca paper trading.")
                st.json(account_info)
        else:
            st.error("Alpaca keys not found in Streamlit Secrets. Using local $100 simulation.")
            use_alpaca = False

    st.subheader("Manual Order Ticket (risk-checked)")
    c1, c2, c3, c4 = st.columns(4)
    sym = c1.selectbox("Symbol", symbols)
    side = c2.selectbox("Side", ["buy", "sell"])
    qty = c3.number_input("Qty", min_value=0.001, value=1.0, step=0.1)
    if c4.button("Submit"):
        price = data_client.get_latest_price(sym) or 100.0
        if use_alpaca and alpaca and alpaca.is_live_paper:
            order = alpaca.submit_order(sym, side, qty, price)
        else:
            order = executor.submit_order(sym, side, qty, price)
        if order.status in ("filled", "accepted", "new", "pending_new"):
            st.success(f"{order.status.upper()}: {order.side} {order.qty} {order.symbol} — {order.message}")
        else:
            st.error(f"Rejected / Error: {order.message}")

    st.subheader("Account Snapshot")
    if use_alpaca and alpaca and account_info and "error" not in account_info:
        st.json(account_info)
    else:
        st.json(executor.get_account())
    st.json(risk.status_report())


def render_autonomous_control(symbols):
    st.header("🤖 Autonomous Runner Control Panel")
    st.markdown(
        "Start or stop the continuous trading loop from the browser. "
        "The process runs in the background and respects all risk limits."
    )

    st.warning(
        "**Important:** There is no strategy that guarantees daily profits. "
        "This runner will trade only when signals pass the risk gates. "
        "Expect flat or losing days."
    )

    col1, col2 = st.columns(2)
    interval = col1.selectbox(
        "Cycle interval",
        options=[60, 120, 300, 600],
        format_func=lambda x: f"{x} seconds ({x//60} min)" if x >= 60 else f"{x}s",
        index=2,
    )
    use_alpaca = col2.checkbox("Use Alpaca paper keys", value=False)

    if "runner_proc" not in st.session_state:
        st.session_state.runner_proc = None
    if "runner_log" not in st.session_state:
        st.session_state.runner_log = []

    proc = st.session_state.runner_proc
    is_running = proc is not None and proc.poll() is None

    c_start, c_stop, c_status = st.columns(3)

    with c_start:
        if st.button("▶ Start Autonomous Runner", type="primary", disabled=is_running):
            cmd = [
                sys.executable, str(ROOT / "run_autonomous.py"),
                "--interval", str(interval),
            ]
            if use_alpaca:
                cmd.append("--alpaca")
            if symbols:
                cmd.extend(["--symbols", ",".join(symbols)])

            try:
                p = subprocess.Popen(
                    cmd, cwd=str(ROOT),
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                )
                st.session_state.runner_proc = p
                st.session_state.runner_log.append(
                    f"{datetime.now().strftime('%H:%M:%S')} – Started (PID {p.pid})"
                )
                st.success(f"Runner started (PID {p.pid})")
                st.rerun()
            except Exception as e:
                st.error(f"Failed to start: {e}")

    with c_stop:
        if st.button("⏹ Stop Runner", disabled=not is_running):
            if proc:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                st.session_state.runner_log.append(
                    f"{datetime.now().strftime('%H:%M:%S')} – Stopped"
                )
                st.session_state.runner_proc = None
                st.success("Runner stopped")
                st.rerun()

    with c_status:
        if is_running:
            st.success(f"Running (PID {proc.pid})")
        else:
            st.info("Not running")

    st.subheader("Recent Control Log")
    for line in st.session_state.runner_log[-15:]:
        st.text(line)


if __name__ == "__main__":
    main()
