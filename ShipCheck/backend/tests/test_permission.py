import pytest

from app.core.errors import AppError
from app.services.browser import BrowserSession


def test_destructive_click_blocked():
    """allow_destructive=False 时,破坏性点击被拦截。"""
    bs = BrowserSession(allow_destructive=False)
    bs.start()  # mock 模式空操作
    with pytest.raises(AppError) as exc:
        bs.click("#delete", destructive=True)
    assert exc.value.code == "permission_denied"


def test_non_destructive_click_allowed():
    bs = BrowserSession(allow_destructive=False)
    bs.start()
    bs.click("#login", destructive=False)  # 不抛


def test_destructive_click_allowed_when_enabled():
    bs = BrowserSession(allow_destructive=True)
    bs.start()
    bs.click("#delete", destructive=True)  # 不抛


def test_destructive_type_blocked():
    bs = BrowserSession(allow_destructive=False)
    bs.start()
    with pytest.raises(AppError) as exc:
        bs.type("#input", "text", destructive=True)
    assert exc.value.code == "permission_denied"
