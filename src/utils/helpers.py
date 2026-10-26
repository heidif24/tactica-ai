"""Shared utilities for Tactica AI."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv
from loguru import logger


def load_config(path: str | Path = "config.yaml") -> dict[str, Any]:
    """Load YAML configuration."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Config not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def setup_logging(level: str = "INFO") -> None:
    """Configure loguru logging."""
    logger.remove()
    logger.add(
        "logs/tactica_{time:YYYY-MM-DD}.log",
        rotation="1 day",
        retention="30 days",
        level=level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    )
    logger.add(
        lambda msg: print(msg, end=""),
        level=level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}\n",
    )


def get_env(key: str, default: str | None = None) -> str | None:
    """
    Get a config value from (in order):
    1. Streamlit secrets (when running on Streamlit Cloud)
    2. OS environment / .env file
    """
    try:
        import streamlit as st
        if hasattr(st, "secrets") and key in st.secrets:
            val = st.secrets[key]
            if val is not None and str(val).strip():
                return str(val).strip()
    except Exception:
        pass

    load_dotenv()
    val = os.getenv(key, default)
    if val is not None:
        return str(val).strip()
    return default
