export * from "./core";
export * from "./models";
export * from "./cox";
export * from "./advisor";
export * from "./exportBrief";

export const STATS_CATALOG = [
  { id: "overview", label: "Dataset overview", r: "str(), summary()", stata: "describe, codebook" },
  { id: "descriptive", label: "Descriptive statistics", r: "summary()", stata: "summarize, tabstat" },
  { id: "correlation", label: "Correlations", r: "cor()", stata: "pwcorr" },
  { id: "ttest", label: "Two-sample t-test", r: "t.test()", stata: "ttest" },
  { id: "anova", label: "One-way ANOVA", r: "aov()", stata: "oneway, anova" },
  { id: "chisq", label: "Chi-square test", r: "chisq.test()", stata: "tabulate, chi2" },
  { id: "regression", label: "Linear regression (OLS)", r: "lm()", stata: "regress" },
  { id: "survival", label: "Kaplan–Meier survival", r: "survfit()", stata: "sts list / graph" },
  { id: "cox", label: "Cox proportional hazards", r: "coxph()", stata: "stcox" },
  { id: "multilevel", label: "Multilevel (random intercept)", r: "lmer()", stata: "mixed" },
  { id: "missing", label: "Missing data", r: "naniar", stata: "misstable" },
  { id: "quality", label: "Data quality", r: "janitor", stata: "duplicates" },
] as const;
