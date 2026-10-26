# Tactica AI – AI Trading Lab

> **First milestone is evidence, not income.**  
> A modular, risk-controlled paper-trading system built for a hard $100 capital ceiling.

Tactica AI is a small, fully local Python application that:

- Pulls market data (Alpaca preferred, simulated fallback)
- Generates transparent momentum / statistical signals
- Estimates probability of a positive return over a short horizon
- Enforces **hard risk limits** that no signal or model can override
- Simulates or paper-trades via Alpaca
- Provides a Streamlit dashboard for monitoring, backtesting and control

Live capital is deliberately disabled until you have months of simulated evidence.

---

## Hosting (important)

This is a **Streamlit** app. It needs a long-running process.

| Platform | Suitable? | Notes |
|----------|-----------|-------|
| **Your computer** | ✅ Best for now | `streamlit run app.py` |
| **Streamlit Community Cloud** | ✅ Recommended free host | Connect this GitHub repo at share.streamlit.io |
| **Railway / Render** | ✅ Good | Free tiers available |
| **Vercel** | ❌ Not for Streamlit | Only a status JSON endpoint deploys here. Real dashboard will not run on Vercel. |

Vercel deployment is fixed so it no longer errors, but it only serves an info page. Use Streamlit Cloud or local for the actual trading UI.

---

## Architecture

```
Data Module        → historical + latest prices
Signal Module      → testable rules (momentum, trend)
Prediction Module  → P(positive return) + uncertainty
Risk Module        → position size, exposure, drawdown, halt  ← cannot be overridden
Execution Module   → simulated fills or Alpaca paper orders
Dashboard          → Streamlit UI for everything above
```

The risk module is the final gate. Signals and any future AI models only propose; risk decides.

---

## Quick Start (Zero Cost)

```bash
# 1. Clone
git clone https://github.com/heidif24/tactica-ai.git
cd tactica-ai

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 3. Install
pip install -r requirements.txt

# 4. (Optional) Add Alpaca paper keys
cp .env.example .env
# Edit .env with your paper API key + secret from https://app.alpaca.markets

# 5. Launch dashboard
streamlit run app.py
```

The app works completely offline with simulated data if no Alpaca keys are present.

---

## Configuration

All limits live in `config.yaml`:

| Setting                    | Default | Meaning                                      |
|---------------------------|---------|----------------------------------------------|
| `risk.max_total_capital`  | 100     | Absolute ceiling the system may ever use     |
| `risk.max_position_pct`   | 0.20    | Max 20 % of equity in one name               |
| `risk.max_drawdown_pct`   | 0.10    | Trading halts at 10 % drawdown               |
| `risk.max_daily_loss_pct` | 0.03    | Trading halts at 3 % daily loss              |
| `strategy.lookback_days`  | 20      | Momentum lookback                            |
| `strategy.momentum_threshold` | 0.025 | Stricter momentum threshold                |

Change these values carefully. The risk module reads them on every order.

---

## Evidence Checklist (before considering live capital)

1. **Backtest** with realistic slippage (5 bps default) and the same risk limits.
2. Hold out a period the strategy never saw during development.
3. Run paper / simulated trading for **8–12 weeks** across different regimes.
4. Track:
   - Net return after costs
   - Maximum drawdown
   - Trade frequency
   - Performance vs buy-and-hold benchmark (SPY)
5. Only then evaluate a $100 live pilot **if** your broker accepts your country of residence and you can afford to lose the entire amount.

Simulated profits are experimental results, not income.

---

## Project Layout

```
tactica-ai/
├── app.py                 # Streamlit dashboard
├── run_autonomous.py      # Continuous trading loop
├── config.yaml            # All tunable parameters + hard risk limits
├── requirements.txt
├── .env.example
├── api/                   # Vercel status endpoint only
├── src/
│   ├── data/
│   ├── signals/           # Momentum + Mean-reversion (pendulum)
│   ├── prediction/
│   ├── risk/
│   ├── execution/
│   ├── backtest/
│   └── utils/
├── strategies/
├── data/
├── logs/
└── tests/
```

---

## Safety Philosophy

- The AI / signal layer never receives unrestricted access to accounts or the host machine.
- Risk limits are enforced in code on every order path.
- Default mode is pure simulation. Alpaca paper requires explicit keys.
- Live trading is a deliberate, separate configuration change that should only happen after the evidence checklist above is satisfied.
- Alpaca’s own documentation notes that paper trading does not fully capture slippage, market impact or regulatory fees.

---

## Next Steps After the Prototype

1. Improve the predictor with a simple scikit-learn model trained only on past data.
2. Add more signal families and ensemble them under risk.
3. Extend the backtester with walk-forward optimization.
4. Optional: run the bot headlessly on a cheap VPS only after multi-week paper evidence.
5. Keep the $100 ceiling until the edge is statistically clear.

---

## License & Disclaimer

This software is for educational and research purposes.  
Trading involves substantial risk of loss. Past simulated performance is not indicative of future results.  
You are solely responsible for any capital you choose to deploy.

Built with the principle: **evidence first, capital second.**
