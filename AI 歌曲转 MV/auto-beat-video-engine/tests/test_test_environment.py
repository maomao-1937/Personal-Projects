import sys

from backend.version import APP_VERSION


def test_python_and_version_baseline() -> None:
    assert sys.version_info >= (3, 11)
    assert APP_VERSION
