export * from "./core";
export * from "./models";

/** Catalog of analyses – R / Stata equivalents */
export const STATS_CATALOG = [
  {
    id: "overview",
    label: "Dataset overview",
    r: "str(), summary()",
    stata: "describe, codebook",
  },
  {
    id: "descriptive",
    label: "Descriptive statistics",
    r: "summary(), psych::describe()",
    stata: "summarize, tabstat",
  },
  {
    id: "correlation",
    label: "Correlations",
    r: "cor(), corrplot",
    stata: "pwcorr, spearman",
  },
  {
    id: "ttest",
    label: "Two-sample t-test",
    r: "t.test()",
    stata: "ttest",
  },
  {
    id: "anova",
    label: "One-way ANOVA",
    r: "aov(), anova()",
    stata: "oneway, anova",
  },
  {
    id: "chisq",
    label: "Chi-square test",
    r: "chisq.test()",
    stata: "tabulate, chi2",
  },
  {
    id: "regression",
    label: "Linear regression (OLS)",
    r: "lm()",
    stata: "regress",
  },
  {
    id: "survival",
    label: "Kaplan–Meier survival",
    r: "survival::survfit()",
    stata: "sts list / sts graph",
  },
  {
    id: "multilevel",
    label: "Multilevel (random intercept)",
    r: "lme4::lmer()",
    stata: "mixed",
  },
  {
    id: "quality",
    label: "Data quality",
    r: "naniar, janitor",
    stata: "misstable, duplicates",
  },
] as const;
