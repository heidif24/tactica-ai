"""Core analysis engine – descriptive, relationships, groups, trends."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy import stats


@dataclass
class AnalysisResult:
    title: str
    summary: str
    tables: dict[str, pd.DataFrame] = field(default_factory=dict)
    metrics: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def profile_dataset(df: pd.DataFrame) -> AnalysisResult:
    n, p = df.shape
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    missing_pct = (df.isna().sum().sum() / max(n * p, 1)) * 100

    summary = (
        f"Your data has **{n:,} rows** and **{p} columns**. "
        f"There are **{len(num_cols)} numeric** columns and **{len(cat_cols)} text/category** columns. "
        f"Overall missing values: **{missing_pct:.1f}%**."
    )

    overview = pd.DataFrame({
        "Column": df.columns,
        "Type": [str(df[c].dtype) for c in df.columns],
        "Non-missing": [int(df[c].notna().sum()) for c in df.columns],
        "Missing %": [round(df[c].isna().mean() * 100, 1) for c in df.columns],
        "Unique values": [int(df[c].nunique()) for c in df.columns],
    })

    return AnalysisResult(
        title="Dataset overview",
        summary=summary,
        tables={"Column summary": overview},
        metrics={"rows": n, "columns": p, "numeric": len(num_cols), "categorical": len(cat_cols)},
    )


def descriptive_stats(df: pd.DataFrame) -> AnalysisResult:
    num = df.select_dtypes(include=[np.number])
    if num.empty:
        return AnalysisResult(
            title="Descriptive statistics",
            summary="No numeric columns found to summarise.",
        )

    desc = num.describe().T
    desc["missing"] = num.isna().sum()
    desc = desc.round(3)

    summary = (
        f"Summary statistics for **{len(num.columns)} numeric columns**. "
        "This shows typical values, spread, and extremes for each measure."
    )
    return AnalysisResult(
        title="Descriptive statistics",
        summary=summary,
        tables={"Numeric summary": desc.reset_index().rename(columns={"index": "Column"})},
    )


def correlation_analysis(df: pd.DataFrame, method: str = "pearson") -> AnalysisResult:
    num = df.select_dtypes(include=[np.number])
    if num.shape[1] < 2:
        return AnalysisResult(
            title="Relationships between numbers",
            summary="Need at least two numeric columns to study relationships.",
        )

    corr = num.corr(method=method).round(3)
    pairs = []
    cols = corr.columns.tolist()
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            pairs.append((cols[i], cols[j], corr.iloc[i, j]))
    pairs = sorted(pairs, key=lambda x: abs(x[2]), reverse=True)[:10]
    strong = pd.DataFrame(pairs, columns=["Variable A", "Variable B", "Correlation"])

    summary = (
        "Correlation shows how numeric columns move together. "
        "Values near **1** mean they rise together; near **-1** means one rises while the other falls; "
        "near **0** means little linear relationship."
    )
    return AnalysisResult(
        title="Relationships between numbers",
        summary=summary,
        tables={
            "Correlation matrix": corr.reset_index().rename(columns={"index": "Variable"}),
            "Strongest pairs": strong,
        },
        metrics={"method": method},
    )


def missing_data_report(df: pd.DataFrame) -> AnalysisResult:
    miss = df.isna().sum()
    miss = miss[miss > 0].sort_values(ascending=False)
    if miss.empty:
        return AnalysisResult(
            title="Missing data",
            summary="Good news: there are **no missing values** in this dataset.",
        )
    table = pd.DataFrame({
        "Column": miss.index,
        "Missing count": miss.values,
        "Missing %": (miss.values / len(df) * 100).round(1),
    })
    summary = (
        f"**{len(miss)} columns** have missing values. "
        "High missing rates can bias results; consider why data is absent."
    )
    return AnalysisResult(title="Missing data", summary=summary, tables={"Missing by column": table})


def outlier_report(df: pd.DataFrame, z_thresh: float = 3.0) -> AnalysisResult:
    num = df.select_dtypes(include=[np.number])
    if num.empty:
        return AnalysisResult(title="Unusual values (outliers)", summary="No numeric columns to check.")

    rows = []
    for c in num.columns:
        s = num[c].dropna()
        if len(s) < 5:
            continue
        z = np.abs(stats.zscore(s))
        n_out = int((z > z_thresh).sum())
        if n_out:
            rows.append({"Column": c, "Unusual values": n_out, "Share %": round(n_out / len(s) * 100, 1)})

    if not rows:
        return AnalysisResult(
            title="Unusual values (outliers)",
            summary="No strong outliers detected using a standard threshold (about 3 standard deviations).",
        )
    table = pd.DataFrame(rows)
    summary = (
        "Outliers are values far from the typical range. "
        "They may be errors, rare events, or important extremes — inspect before removing them."
    )
    return AnalysisResult(title="Unusual values (outliers)", summary=summary, tables={"Outlier counts": table})


def group_comparison(df: pd.DataFrame, group_col: str, value_col: str) -> AnalysisResult:
    if group_col not in df.columns or value_col not in df.columns:
        return AnalysisResult(title="Group comparison", summary="Selected columns not found.")

    g = df.groupby(group_col)[value_col].agg(["count", "mean", "median", "std"]).round(3)
    g = g.reset_index()
    summary = (
        f"Comparing **{value_col}** across groups in **{group_col}**. "
        "Look at whether averages differ meaningfully between groups."
    )
    return AnalysisResult(
        title=f"Group comparison: {value_col} by {group_col}",
        summary=summary,
        tables={"Group summary": g},
    )


def simple_trend(df: pd.DataFrame, time_col: str, value_col: str) -> AnalysisResult:
    if time_col not in df.columns or value_col not in df.columns:
        return AnalysisResult(title="Trend", summary="Selected columns not found.")

    tmp = df[[time_col, value_col]].dropna().sort_values(time_col)
    if len(tmp) < 3:
        return AnalysisResult(title="Trend", summary="Not enough points to describe a trend.")

    x = pd.to_numeric(tmp[time_col], errors="coerce")
    if x.isna().all():
        x = np.arange(len(tmp))
    else:
        x = x.values
    y = tmp[value_col].values
    slope, intercept, r, p, se = stats.linregress(x, y)

    direction = "upward" if slope > 0 else "downward" if slope < 0 else "flat"
    summary = (
        f"Overall trend in **{value_col}** looks **{direction}**. "
        f"The linear association strength (r) is **{r:.2f}** "
        f"(p-value ≈ {p:.3f})."
    )
    return AnalysisResult(
        title=f"Trend: {value_col} over {time_col}",
        summary=summary,
        metrics={"slope": slope, "r": r, "p_value": p},
        tables={"Sample of series": tmp.head(20).reset_index(drop=True)},
    )


ANALYSIS_CATALOG = [
    {"id": "overview", "label": "Dataset overview", "description": "How many rows/columns, types of data, basic shape of your file."},
    {"id": "descriptive", "label": "Descriptive statistics", "description": "Averages, medians, spread, min/max for numeric columns."},
    {"id": "missing", "label": "Missing data check", "description": "Which columns have gaps and how large those gaps are."},
    {"id": "outliers", "label": "Unusual values (outliers)", "description": "Values that sit far from the typical range."},
    {"id": "correlation", "label": "Relationships between numbers", "description": "Which numeric measures rise or fall together."},
    {"id": "groups", "label": "Compare groups", "description": "Averages of a number across categories (e.g. by region or type)."},
    {"id": "trend", "label": "Trend over time / order", "description": "Whether a measure is generally rising, falling, or flat."},
    {"id": "distribution", "label": "Shape of distributions", "description": "How values are spread (skewed, symmetric, multi-peak)."},
    {"id": "quality", "label": "Data quality scorecard", "description": "Overall cleanliness: duplicates, missingness, constant columns."},
    {"id": "recommendations", "label": "Plain-English recommendations", "description": "What to fix, explore next, or be careful about."},
]
