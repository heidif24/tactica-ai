"""
Lumen – AI Data Analysis System
Upload data → choose what you care about → clean → analyse → download report.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from src.cleaning.pipeline import clean_dataframe, CleaningReport
from src.analysis.engine import (
    ANALYSIS_CATALOG,
    profile_dataset,
    descriptive_stats,
    correlation_analysis,
    missing_data_report,
    outlier_report,
    group_comparison,
    simple_trend,
    AnalysisResult,
)
from src.report.builder import (
    make_correlation_heatmap,
    make_missing_bar,
    make_distribution_grid,
    build_pdf_report,
    build_docx_report,
)

st.set_page_config(
    page_title="Lumen – Data Analysis",
    page_icon="✦",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .main-title { font-size: 2.1rem; font-weight: 700; letter-spacing: -0.02em; }
    .subtitle { color: #6b7280; margin-bottom: 1.2rem; }
</style>
""", unsafe_allow_html=True)


def load_uploaded_file(uploaded) -> pd.DataFrame | None:
    name = uploaded.name.lower()
    try:
        if name.endswith(".csv"):
            return pd.read_csv(uploaded)
        if name.endswith((".xlsx", ".xls")):
            return pd.read_excel(uploaded)
        if name.endswith(".tsv"):
            return pd.read_csv(uploaded, sep="\t")
        if name.endswith(".json"):
            return pd.read_json(uploaded)
        st.error("Please upload CSV, Excel, TSV, or JSON.")
        return None
    except Exception as e:
        st.error(f"Could not read file: {e}")
        return None


def run_selected_analyses(
    df, selected_ids, group_col, value_col, time_col, trend_value
):
    results = []
    if "overview" in selected_ids:
        results.append(profile_dataset(df))
    if "descriptive" in selected_ids:
        results.append(descriptive_stats(df))
    if "missing" in selected_ids:
        results.append(missing_data_report(df))
    if "outliers" in selected_ids:
        results.append(outlier_report(df))
    if "correlation" in selected_ids:
        results.append(correlation_analysis(df))
    if "groups" in selected_ids and group_col and value_col:
        results.append(group_comparison(df, group_col, value_col))
    if "trend" in selected_ids and time_col and trend_value:
        results.append(simple_trend(df, time_col, trend_value))
    if "distribution" in selected_ids:
        num = df.select_dtypes(include="number")
        if not num.empty:
            results.append(AnalysisResult(
                title="Shape of distributions",
                summary=(
                    f"Histograms for up to four numeric columns are in the downloadable report. "
                    f"You have **{len(num.columns)}** numeric columns."
                ),
                metrics={"numeric_columns": len(num.columns)},
            ))
    if "quality" in selected_ids:
        n_dup = int(df.duplicated().sum())
        const = [c for c in df.columns if df[c].nunique(dropna=False) <= 1]
        miss_pct = df.isna().mean().mean() * 100
        summary = (
            f"Duplicate rows: **{n_dup}**. "
            f"Constant columns: **{len(const)}**. "
            f"Average missing rate: **{miss_pct:.1f}%**."
        )
        results.append(AnalysisResult(
            title="Data quality scorecard",
            summary=summary,
            metrics={"duplicates": n_dup, "constant_columns": len(const)},
            tables={"Constant columns": pd.DataFrame({"Column": const})} if const else {},
        ))
    if "recommendations" in selected_ids:
        tips = []
        if df.isna().any().any():
            tips.append("Some columns still have missing values — decide whether to drop, fill, or collect more data.")
        if df.select_dtypes(include="number").shape[1] >= 2:
            tips.append("Review the strongest correlations; they often suggest useful relationships.")
        tips.append("Always interpret patterns with knowledge of how the data was collected.")
        results.append(AnalysisResult(
            title="Plain-English recommendations",
            summary=" ".join(tips),
            notes=tips,
        ))
    return results


def main():
    st.markdown('<p class="main-title">✦ Lumen</p>', unsafe_allow_html=True)
    st.markdown(
        '<p class="subtitle">Upload your data. Choose what you care about. '
        "Get a clear, cleaned analysis and a downloadable report.</p>",
        unsafe_allow_html=True,
    )

    st.header("Step 1 — Add your data")
    uploaded = st.file_uploader(
        "Upload a file",
        type=["csv", "xlsx", "xls", "tsv", "json"],
    )

    if uploaded is None:
        st.info("Upload a dataset to begin.")
        with st.expander("What Lumen can do"):
            for item in ANALYSIS_CATALOG:
                st.markdown(f"**{item['label']}** — {item['description']}")
        return

    raw = load_uploaded_file(uploaded)
    if raw is None or raw.empty:
        st.warning("The file appears empty or unreadable.")
        return

    st.success(f"Loaded **{len(raw):,} rows** × **{len(raw.columns)} columns** from `{uploaded.name}`.")
    with st.expander("Preview (first 8 rows)"):
        st.dataframe(raw.head(8), use_container_width=True)

    st.header("Step 2 — What are you looking for?")
    st.caption("Select the items that matter to you.")

    defaults = ["overview", "descriptive", "missing", "correlation", "quality", "recommendations"]
    selected = []
    cols = st.columns(2)
    for i, item in enumerate(ANALYSIS_CATALOG):
        with cols[i % 2]:
            checked = st.checkbox(
                f"**{item['label']}**",
                value=item["id"] in defaults,
                help=item["description"],
                key=f"chk_{item['id']}",
            )
            if checked:
                selected.append(item["id"])

    st.subheader("Optional details")
    c1, c2, c3, c4 = st.columns(4)
    cat_cols = raw.select_dtypes(exclude="number").columns.tolist()
    num_cols = raw.select_dtypes(include="number").columns.tolist()
    all_cols = raw.columns.tolist()

    group_col = c1.selectbox("Group column", ["—"] + cat_cols + num_cols)
    value_col = c2.selectbox("Value column (groups)", ["—"] + num_cols)
    time_col = c3.selectbox("Time / order column", ["—"] + all_cols)
    trend_value = c4.selectbox("Value for trend", ["—"] + num_cols)

    group_col = None if group_col == "—" else group_col
    value_col = None if value_col == "—" else value_col
    time_col = None if time_col == "—" else time_col
    trend_value = None if trend_value == "—" else trend_value

    st.header("Step 3 — Clean & analyse")
    if not selected:
        st.warning("Select at least one checklist item.")
        return

    if st.button("Run analysis", type="primary"):
        with st.spinner("Cleaning and analysing..."):
            cleaned, creport = clean_dataframe(raw)
            results = run_selected_analyses(
                cleaned, selected, group_col, value_col, time_col, trend_value
            )
            charts = []
            hm = make_correlation_heatmap(cleaned)
            if hm:
                charts.append(("Correlation heatmap", hm))
            mb = make_missing_bar(raw)
            if mb:
                charts.append(("Missing data", mb))
            dist = make_distribution_grid(cleaned)
            if dist:
                charts.append(("Distributions", dist))

            st.session_state["lumen_cleaned"] = cleaned
            st.session_state["lumen_creport"] = creport
            st.session_state["lumen_results"] = results
            st.session_state["lumen_charts"] = charts

    if "lumen_results" not in st.session_state:
        return

    cleaned = st.session_state["lumen_cleaned"]
    creport = st.session_state["lumen_creport"]
    results = st.session_state["lumen_results"]
    charts = st.session_state["lumen_charts"]

    st.subheader("Cleaning summary")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Rows before", f"{creport.original_rows:,}")
    m2.metric("Rows after", f"{creport.final_rows:,}")
    m3.metric("Columns after", creport.final_cols)
    m4.metric("Duplicates removed", creport.duplicates_removed)
    for note in creport.notes:
        st.caption(f"• {note}")

    st.subheader("Findings")
    for res in results:
        with st.expander(res.title, expanded=True):
            st.markdown(res.summary)
            for tname, tdf in res.tables.items():
                st.markdown(f"**{tname}**")
                st.dataframe(tdf, use_container_width=True)

    if charts:
        st.subheader("Charts")
        for title, png in charts:
            st.markdown(f"**{title}**")
            st.image(png, use_container_width=True)

    st.header("Step 4 — Download your report")
    report_title = st.text_input("Report title", value=f"Lumen report – {uploaded.name}")

    cpdf, cdocx, cpng = st.columns(3)
    with cpdf:
        pdf_bytes = build_pdf_report(report_title, creport, results, charts)
        st.download_button("Download PDF", data=pdf_bytes, file_name="lumen_report.pdf", mime="application/pdf")
    with cdocx:
        docx_bytes = build_docx_report(report_title, creport, results)
        st.download_button(
            "Download Word",
            data=docx_bytes,
            file_name="lumen_report.docx",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    with cpng:
        if charts:
            st.download_button("Download first chart (PNG)", data=charts[0][1], file_name="lumen_chart.png", mime="image/png")
        else:
            st.caption("No charts to download.")

    st.divider()
    st.caption("Lumen — light on your data. For analysis and learning.")


if __name__ == "__main__":
    main()
