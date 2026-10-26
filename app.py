"""
Tactica AI – Simple Trading Dashboard
Plain English. Easy to understand.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from src.utils.helpers import load_config, setup_logging, get_env
from src.data.market_data import MarketDataClient
from src.risk.risk_manager import RiskManager
from src.execution.alpaca_executor import SimulatedExecutor, AlpacaExecutor
from src.signals.momentum import MomentumSignal
from src.signals.mean_reversion import MeanReversionSignal
from strategies.momentum_strategy import MomentumStrategy

st.set_page_config(
    page_title="Tactica AI",
    page_icon="📈",
    layout="centered",
    initial_sidebar_state="collapsed",
)

setup_logging()
config = load_config(ROOT / "config.yaml")


def money(value) -> str:
    try:
        return f"${float(value):,.2f}"
    except Exception:
        return "$0.00"


def main():
    st.title("Tactica AI")
    st.caption("Simple paper trading helper. Maximum risk: $100.")

    st.subheader("1. Connection status")

    api_key = get_env("ALPACA_API_KEY")
    secret = get_env("ALPACA_SECRET_KEY")
    keys_present = bool(api_key and secret and not str(api_key).startswith("your_"))

    risk = RiskManager(config)
    alpaca = AlpacaExecutor(risk) if keys_present else None
    using_alpaca = False
    account = {}
    connection_message = ""

    if not keys_present:
        st.error("Alpaca keys not found.")
        st.markdown(
            "Go to your Streamlit app → **Settings → Secrets** and add:\n\n"
            "```\n"
            'ALPACA_API_KEY = "your_paper_key"\n'
            'ALPACA_SECRET_KEY = "your_paper_secret"\n'
            "```\n\n"
            "Use keys from the **Paper Trading** section of Alpaca (not live)."
        )
    else:
        if alpaca and alpaca.is_live_paper:
            account = alpaca.get_account()
            if "error" in account:
                st.error("Keys were found, but Alpaca rejected them.")
                st.write(account.get("error", "Unknown error"))
                st.info(
                    "Most common reasons:\n"
                    "- You used **live** keys instead of **paper** keys\n"
                    "- Extra spaces or quote marks in Secrets\n"
                    "- Keys were copied incompletely\n\n"
                    "Get fresh paper keys here: https://app.alpaca.markets/paper/dashboard/overview"
                )
            else:
                using_alpaca = True
                st.success("Connected to Alpaca paper account.")
                connection_message = "Working with Alpaca paper money."
        else:
            st.warning("Keys found, but could not start Alpaca connection. Using practice mode on this app only.")

    if not using_alpaca:
        if "sim" not in st.session_state:
            st.session_state.sim = SimulatedExecutor(risk, initial_cash=100.0)
        account = st.session_state.sim.get_account()
        connection_message = "Practice mode on this app only (not connected to Alpaca)."

    st.write(connection_message)

    st.subheader("2. Your money right now")

    cash = float(account.get("cash", 100) or 100)
    equity = float(account.get("equity", cash) or cash)

    if using_alpaca:
        col1, col2, col3 = st.columns(3)
        col1.metric("Cash available", money(cash))
        col2.metric("Total account value", money(equity))
        col3.metric("Status", str(account.get("status", "—")))
        st.caption("These numbers come from your Alpaca paper account.")
    else:
        gain_loss = equity - 100.0
        col1, col2, col3 = st.columns(3)
        col1.metric("Starting money", "$100.00")
        col2.metric("Current value", money(equity))
        if gain_loss >= 0:
            col3.metric("You have gained", money(gain_loss))
        else:
            col3.metric("You have lost", money(abs(gain_loss)))

    status = risk.status_report()
    if status.get("trading_halted"):
        st.error("Trading is paused to protect your money (loss limit reached).")
    else:
        st.info("Trading is allowed. Safety limits are active.")

    st.divider()

    st.subheader("3. What do you want to do?")

    tab1, tab2, tab3 = st.tabs(["Check signals", "Place a test trade", "Run automatically"])

    symbols = config["universe"]["default_symbols"][:5]
    data_client = MarketDataClient(cache_dir=str(ROOT / "data" / "cache"))

    with tab1:
        st.write("The system looks at the market and suggests buy, sell, or wait.")
        if st.button("Check market now"):
            with st.spinner("Looking at the market..."):
                mom = MomentumSignal(lookback=20, threshold=0.025)
                mr = MeanReversionSignal(lookback=20, z_entry=1.8)
                rows = []
                for sym in symbols:
                    bars = data_client.get_bars(sym)
                    if bars is None or bars.empty:
                        continue
                    sig = mom.generate(sym, bars)
                    if not sig or sig.signal == "hold":
                        sig = mr.generate(sym, bars)
                    if not sig:
                        continue
                    action = "Wait"
                    if sig.signal == "buy":
                        action = "Consider buying"
                    elif sig.signal == "sell":
                        action = "Consider selling"
                    rows.append({
                        "Stock": sym,
                        "Suggestion": action,
                        "Simple reason": sig.reason,
                    })
                if rows:
                    st.table(rows)
                else:
                    st.write("No clear suggestion right now. Waiting is often the best choice.")

    with tab2:
        st.write("Place one small practice trade. It always goes through the safety checks.")
        c1, c2, c3 = st.columns(3)
        sym = c1.selectbox("Stock", symbols)
        side = c2.selectbox("Action", ["buy", "sell"])
        qty = c3.number_input("How many shares", min_value=0.01, value=1.0, step=0.1)

        if st.button("Send trade"):
            price = data_client.get_latest_price(sym) or 100.0
            if using_alpaca and alpaca:
                order = alpaca.submit_order(sym, side, qty, price)
            else:
                order = st.session_state.sim.submit_order(sym, side, qty, price)

            if order.status in ("filled", "accepted", "new", "pending_new"):
                st.success(f"Trade sent: {side} {order.qty} {sym}. Status: {order.status}")
            else:
                st.error(f"Trade was blocked or failed: {order.message}")
            st.rerun()

    with tab3:
        st.write(
            "This mode keeps checking the market every few minutes and may place trades "
            "when the rules say so. It will stop itself if losses get too large."
        )
        st.warning(
            "There is no guarantee of profit. Many periods will have no trades. "
            "That is normal and safer than forcing trades."
        )

        interval = st.selectbox(
            "How often should it check?",
            options=[60, 120, 300, 600],
            format_func=lambda x: f"Every {x // 60} minute(s)" if x >= 60 else f"Every {x} seconds",
            index=2,
        )

        if "auto_running" not in st.session_state:
            st.session_state.auto_running = False
        if "auto_log" not in st.session_state:
            st.session_state.auto_log = []
        if "last_cycle" not in st.session_state:
            st.session_state.last_cycle = None

        col_a, col_b = st.columns(2)
        with col_a:
            if st.button("Start automatic mode", type="primary", disabled=st.session_state.auto_running):
                st.session_state.auto_running = True
                st.session_state.auto_log.append(f"{datetime.now().strftime('%H:%M')} – Automatic mode started")
                st.rerun()
        with col_b:
            if st.button("Stop automatic mode", disabled=not st.session_state.auto_running):
                st.session_state.auto_running = False
                st.session_state.auto_log.append(f"{datetime.now().strftime('%H:%M')} – Automatic mode stopped")
                st.rerun()

        if st.session_state.auto_running:
            st.success("Automatic mode is ON. Keep this page open.")
            now = datetime.now()
            should_run = (
                st.session_state.last_cycle is None
                or (now - st.session_state.last_cycle).total_seconds() >= interval
            )
            if should_run:
                try:
                    _run_one_auto_cycle(data_client, risk, symbols, using_alpaca, alpaca)
                    st.session_state.last_cycle = now
                    st.session_state.auto_log.append(f"{now.strftime('%H:%M:%S')} – Checked market")
                except Exception as e:
                    st.session_state.auto_log.append(f"{now.strftime('%H:%M:%S')} – Error: {e}")
            st.caption(f"Checks about every {interval} seconds while this page stays open.")
        else:
            st.info("Automatic mode is OFF.")

        if st.session_state.auto_log:
            st.write("Recent activity:")
            for line in st.session_state.auto_log[-12:]:
                st.text(line)

    st.divider()
    st.caption(
        "This tool is for learning and paper trading only. "
        "You can lose money. Past results do not guarantee future results."
    )


def _run_one_auto_cycle(data_client, risk, symbols, using_alpaca, alpaca):
    if risk.state.trading_halted:
        return

    data = {}
    prices = {}
    for sym in symbols:
        bars = data_client.get_bars(sym)
        if bars is not None and not bars.empty:
            data[sym] = bars
            prices[sym] = float(bars["close"].iloc[-1])

    if not data:
        return

    if not using_alpaca:
        if "sim" not in st.session_state:
            st.session_state.sim = SimulatedExecutor(risk, initial_cash=100.0)
        st.session_state.sim.update_prices(prices)
        executor = st.session_state.sim
    else:
        executor = st.session_state.get("sim") or SimulatedExecutor(risk, initial_cash=100.0)

    strategy = MomentumStrategy(config, risk, executor)
    actions = strategy.evaluate(data)
    for act in actions:
        sym = act["symbol"]
        side = act["side"]
        price = prices.get(sym) or act["signal"].price
        strength = act["signal"].strength
        target = risk.state.equity * risk.max_position_pct * max(strength, 0.3)
        qty = target / price if price > 0 else 0
        if qty <= 0:
            continue
        if using_alpaca and alpaca:
            alpaca.submit_order(sym, side, qty, price)
        else:
            st.session_state.sim.submit_order(sym, side, qty, price)


if __name__ == "__main__":
    main()
