"""Data cleaning and polishing pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class CleaningReport:
    original_rows: int = 0
    original_cols: int = 0
    final_rows: int = 0
    final_cols: int = 0
    missing_before: dict[str, int] = field(default_factory=dict)
    missing_after: dict[str, int] = field(default_factory=dict)
    duplicates_removed: int = 0
    columns_dropped: list[str] = field(default_factory=list)
    columns_renamed: dict[str, str] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def clean_dataframe(
    df: pd.DataFrame,
    drop_empty_cols: bool = True,
    drop_high_missing: float = 0.95,
    fill_numeric: str = "median",
    fill_categorical: str = "mode",
    remove_duplicates: bool = True,
    strip_strings: bool = True,
) -> tuple[pd.DataFrame, CleaningReport]:
    report = CleaningReport(
        original_rows=len(df),
        original_cols=len(df.columns),
    )
    out = df.copy()

    new_names = {}
    for c in out.columns:
        nc = str(c).strip().lower().replace(" ", "_").replace("-", "_")
        while "__" in nc:
            nc = nc.replace("__", "_")
        new_names[c] = nc
    out = out.rename(columns=new_names)
    report.columns_renamed = {str(k): v for k, v in new_names.items() if str(k) != v}

    if strip_strings:
        for c in out.select_dtypes(include=["object", "string"]).columns:
            out[c] = out[c].astype(str).str.strip().replace({"nan": np.nan, "None": np.nan, "": np.nan})

    report.missing_before = {c: int(out[c].isna().sum()) for c in out.columns if out[c].isna().any()}

    if drop_empty_cols:
        empty = [c for c in out.columns if out[c].isna().all()]
        if empty:
            out = out.drop(columns=empty)
            report.columns_dropped.extend(empty)
            report.notes.append(f"Dropped {len(empty)} completely empty column(s).")

    if drop_high_missing < 1.0:
        high = [c for c in out.columns if out[c].isna().mean() >= drop_high_missing]
        if high:
            out = out.drop(columns=high)
            report.columns_dropped.extend(high)
            report.notes.append(f"Dropped {len(high)} column(s) with ≥{drop_high_missing:.0%} missing values.")

    if remove_duplicates:
        before = len(out)
        out = out.drop_duplicates()
        report.duplicates_removed = before - len(out)
        if report.duplicates_removed:
            report.notes.append(f"Removed {report.duplicates_removed} duplicate row(s).")

    for c in out.columns:
        if out[c].isna().sum() == 0:
            continue
        if pd.api.types.is_numeric_dtype(out[c]):
            if fill_numeric == "median":
                out[c] = out[c].fillna(out[c].median())
            elif fill_numeric == "mean":
                out[c] = out[c].fillna(out[c].mean())
            elif fill_numeric == "zero":
                out[c] = out[c].fillna(0)
        else:
            if fill_categorical == "mode":
                mode = out[c].mode()
                if len(mode):
                    out[c] = out[c].fillna(mode.iloc[0])
            elif fill_categorical == "unknown":
                out[c] = out[c].fillna("Unknown")

    report.missing_after = {c: int(out[c].isna().sum()) for c in out.columns if out[c].isna().any()}
    report.final_rows = len(out)
    report.final_cols = len(out.columns)
    report.notes.append(
        f"Shape: {report.original_rows}×{report.original_cols} → {report.final_rows}×{report.final_cols}"
    )
    return out, report
