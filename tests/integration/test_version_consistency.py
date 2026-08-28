from __future__ import annotations

import tomllib
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config import Settings
from backend.version import APP_VERSION


ROOT = Path(__file__).resolve().parents[2]


def test_health_package_and_readme_use_the_same_version(tmp_path) -> None:
    package = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    settings = Settings(
        _env_file=None,
        app_env="test",
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
    )
    with TestClient(create_app(settings)) as client:
        health_version = client.get("/api/v1/health").json()["version"]

    assert package["project"]["version"] == APP_VERSION
    assert health_version == APP_VERSION
    assert f"当前后端版本：`{APP_VERSION}`" in readme
