# Tactica AI – End-to-End Setup Guide

This guide gets you from zero to a running autonomous paper-trading system.

## 1. Prerequisites

- Python 3.10+
- A free Alpaca account (paper trading is available worldwide)

## 2. Create Alpaca Paper Account

1. Go to https://alpaca.markets and sign up.
2. Choose **Paper Trading** (or switch to the Paper dashboard).
3. Navigate to **API Keys** → Generate new key.
4. Copy the **API Key ID** and **Secret Key** (secret is shown only once).

## 3. Install & Configure

```bash
git clone https://github.com/heidif24/tactica-ai.git
cd tactica-ai

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env and paste your paper keys:
# ALPACA_API_KEY=...
# ALPACA_SECRET_KEY=...
```

## 4. Launch Options

### A. Interactive Dashboard (recommended first)

```bash
streamlit run app.py
```

- Explore market data and signals
- Run backtests
- Place manual paper orders (risk-checked)
- Switch between local simulation and Alpaca paper

### B. Autonomous Continuous Runner

```bash
# Local simulation, every 5 minutes
python run_autonomous.py

# Every 60 seconds
python run_autonomous.py --interval 60

# Use real Alpaca paper account
python run_autonomous.py --alpaca --interval 300

# Custom symbols
python run_autonomous.py --symbols SPY,QQQ,AAPL,MSFT --interval 120
```

The runner will:
- Evaluate the momentum strategy on each cycle
- Size positions according to risk limits
- Submit paper orders (or simulated fills)
- Halt automatically if daily loss or drawdown limits are hit
- Log every decision

Stop it cleanly with `Ctrl+C`.

## 5. Risk Limits (hard-coded, cannot be overridden by the strategy)

| Limit                    | Default | Meaning                          |
|--------------------------|---------|----------------------------------|
| Max total capital        | $100    | Absolute ceiling                 |
| Max position size        | 20%     | Per symbol                       |
| Max portfolio exposure   | 80%     | Total invested                   |
| Max daily loss           | 3%      | Auto-halt                        |
| Max drawdown             | 10%     | Auto-halt                        |
| Min cash reserve         | 15%     | Always keep dry powder           |

Edit `config.yaml` to change these values. The risk module reads them on every order.

## 6. Realistic Expectations

- With $100 capital, even a strong 1% daily return is only $1.
- Frequent trading increases costs and noise.
- Paper trading does **not** fully capture slippage, market impact, or fees.
- The first goal is a working, measurable system — not guaranteed income.
- Only consider live capital after weeks of paper evidence and only if you can afford to lose the entire amount.

## 7. Next Improvements (after basic runs)

1. Add more signal types and ensemble them.
2. Train a simple scikit-learn model on historical features.
3. Add walk-forward backtesting.
4. Optional headless VPS deployment once paper results are solid.

---

**Principle:** Evidence first. Capital second.
