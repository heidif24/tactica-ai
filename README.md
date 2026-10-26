# ✦ Lumen

**Light on your data.**

Lumen is a complete, browser-based data analysis system:

1. **Upload** your dataset (CSV, Excel, TSV, JSON)
2. **Choose** what you care about from a clear checklist (~10 options)
3. **Clean** — missing values, duplicates, column names, polish
4. **Analyse** — overview, descriptives, correlations, groups, trends, quality, recommendations
5. **Download** a full report as **PDF**, **Word**, or chart **PNG**

Plain-language summaries. Professional tables and charts. No trading jargon.

---

## Quick start

```bash
git clone https://github.com/heidif24/tactica-ai.git
cd tactica-ai
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

Or deploy the same way on **Streamlit Community Cloud** with main file `app.py`.

---

## Analysis checklist (what you can ask for)

| Item | What you get |
|------|----------------|
| Dataset overview | Rows, columns, types, basic shape |
| Descriptive statistics | Mean, median, spread, min/max |
| Missing data check | Where the gaps are |
| Unusual values (outliers) | Extreme points worth a second look |
| Relationships between numbers | Correlations and strongest pairs |
| Compare groups | Averages by category |
| Trend over time / order | Rising, falling, or flat |
| Shape of distributions | Histograms in the report |
| Data quality scorecard | Duplicates, constant columns, missing rate |
| Plain-English recommendations | What to fix or explore next |

---

## Stack

- **Python** — pandas, scipy, statsmodels, scikit-learn, seaborn, plotly
- **Reports** — ReportLab (PDF), python-docx (Word), matplotlib (PNG)
- **UI** — Streamlit

Designed so the experience feels as complete as a light R / Stata / Python workflow, without requiring the user to write code.

---

## Licence & care

For analysis and education. Always interpret results in the context of how the data was collected.
