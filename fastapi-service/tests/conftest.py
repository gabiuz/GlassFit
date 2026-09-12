from __future__ import annotations

import sys
from pathlib import Path

import pytest


SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--run-real-cv",
        action="store_true",
        default=False,
        help="Run tests that require a warmed FastAPI service with real CV models.",
    )


def pytest_collection_modifyitems(
    config: pytest.Config,
    items: list[pytest.Item],
) -> None:
    if config.getoption("--run-real-cv"):
        return

    skip_real_cv = pytest.mark.skip(reason="Pass --run-real-cv to run real CV tests.")
    for item in items:
        if "performance" in item.keywords:
            item.add_marker(skip_real_cv)
