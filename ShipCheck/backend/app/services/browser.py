"""浏览器会话。Playwright 真实 + mock 模式。写操作受 allow_destructive 约束。"""
import time
import uuid

from app.core.config import settings
from app.core.errors import AppError
from app.core.logger import logger


class BrowserSession:
    def __init__(self, allow_destructive: bool = False):
        self.allow_destructive = allow_destructive
        self._pw = None
        self._browser = None
        self._page = None
        self._current_url = ""

    # ===== 生命周期 =====

    def start(self) -> None:
        if settings.mock_mode:
            return
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        self._page = self._browser.new_page(viewport={"width": 1280, "height": 800})

    def close(self) -> None:
        if settings.mock_mode:
            return
        try:
            if self._page:
                self._page.close()
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception as e:  # noqa: BLE001
            logger.warning("browser close error: %s", e)

    # ===== 读操作(始终允许) =====

    def navigate(self, url: str) -> None:
        self._current_url = url
        if settings.mock_mode:
            return
        try:
            self._page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=settings.item_timeout_seconds * 1000,
            )
        except Exception as e:  # noqa: BLE001
            raise AppError(
                "browser_error",
                f"导航失败: {url} - {type(e).__name__}",
                502,
            )

    def screenshot(self) -> str:
        """返回截图绝对路径。mock 模式返回空串(调用方记 text 证据)。"""
        if settings.mock_mode:
            return ""
        path = (
            settings.abs_screenshot_dir
            / f"shot_{uuid.uuid4().hex[:12]}_{int(time.time())}.png"
        )
        try:
            self._page.screenshot(path=str(path), full_page=False)
            return str(path)
        except Exception as e:  # noqa: BLE001
            raise AppError(
                "browser_error", f"截图失败: {type(e).__name__}", 502
            )

    def get_text(self, selector: str = "body") -> str:
        if settings.mock_mode:
            return f"[mock] page text of {self._current_url}"
        try:
            return self._page.inner_text(selector, timeout=5000)
        except Exception as e:  # noqa: BLE001
            raise AppError(
                "browser_error",
                f"取文本失败: {selector} - {type(e).__name__}",
                502,
            )

    def get_dom(self, selector: str = "body") -> str:
        if settings.mock_mode:
            return f"[mock] dom of {self._current_url}"
        try:
            return self._page.inner_html(selector, timeout=5000)
        except Exception as e:  # noqa: BLE001
            raise AppError(
                "browser_error",
                f"取 DOM 失败: {selector} - {type(e).__name__}",
                502,
            )

    # ===== 写操作(受权限约束) =====

    def click(self, selector: str, destructive: bool = False) -> None:
        if destructive and not self.allow_destructive:
            raise AppError(
                "permission_denied",
                f"破坏性点击被拦截(allow_destructive=false): {selector}",
                403,
            )
        if settings.mock_mode:
            return
        try:
            self._page.click(selector, timeout=5000)
        except Exception as e:  # noqa: BLE001
            raise AppError(
                "browser_error",
                f"点击失败: {selector} - {type(e).__name__}",
                502,
            )

    def type(self, selector: str, text: str, destructive: bool = True) -> None:
        if destructive and not self.allow_destructive:
            raise AppError(
                "permission_denied",
                f"输入被拦截(破坏性): {selector}",
                403,
            )
        if settings.mock_mode:
            return
        try:
            self._page.fill(selector, text, timeout=5000)
        except Exception as e:  # noqa: BLE001
            raise AppError(
                "browser_error",
                f"输入失败: {selector} - {type(e).__name__}",
                502,
            )
