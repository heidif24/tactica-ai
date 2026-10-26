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
    """Get environment variable after loading .env."""
    load_dotenv()
    return os.getenv(key, default)
