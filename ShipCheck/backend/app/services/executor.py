"""执行单个 checklist item。MVP 只做"加载页面 + 采证",不做点击流(见阶段文档第七节)。"""
from app.core.errors import AppError
from app.core.logger import logger
from app.models.models import Evidence
from app.services.browser import BrowserSession


def execute_item(target_url: str, allow_destructive: bool) -> list[Evidence]:
    """加载 target_url,采集截图/文本/DOM 三类证据。
    返回 Evidence ORM 对象列表(未持久化,由调用方加到 session)。
    """
    ev: list[Evidence] = []
    bs = BrowserSession(allow_destructive=allow_destructive)
    bs.start()
    try:
        bs.navigate(target_url)
        # 截图
        try:
            shot = bs.screenshot()
            if shot:
                ev.append(
                    Evidence(kind="screenshot", path=shot, content=None)
                )
            else:
                ev.append(
                    Evidence(
                        kind="text",
                        content=f"[mock screenshot] {target_url}",
                    )
                )
        except AppError as e:
            logger.warning("screenshot failed: %s", e.message)
            ev.append(
                Evidence(
                    kind="text", content=f"[screenshot failed] {e.message}"
                )
            )
        # 文本
        try:
            text = bs.get_text("body")
            ev.append(Evidence(kind="text", content=text[:5000]))
        except AppError as e:
            logger.warning("get_text failed: %s", e.message)
        # DOM
        try:
            dom = bs.get_dom("body")
            ev.append(Evidence(kind="dom", content=dom[:5000]))
        except AppError as e:
            logger.warning("get_dom failed: %s", e.message)
    finally:
        bs.close()
    return ev
