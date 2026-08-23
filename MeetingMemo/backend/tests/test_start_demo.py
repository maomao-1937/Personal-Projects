import sys
from types import ModuleType

from scripts.start_demo import _prefer_modern_sqlite


def test_demo_startup_prefers_bundled_sqlite_on_linux(monkeypatch):
    bundled_sqlite = ModuleType("pysqlite3")
    original_sqlite = sys.modules.get("sqlite3")
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setitem(sys.modules, "pysqlite3", bundled_sqlite)

    try:
        _prefer_modern_sqlite()

        assert sys.modules["sqlite3"] is bundled_sqlite
    finally:
        if original_sqlite is None:
            sys.modules.pop("sqlite3", None)
        else:
            sys.modules["sqlite3"] = original_sqlite
