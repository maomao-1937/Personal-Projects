"""速率限制工具模块

基于 slowapi 实现的接口限流，支持 IP 维度和用户维度的限流策略。
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

# 基于 IP 地址的内存限流器
limiter = Limiter(key_func=get_remote_address)


def get_user_id(request: Request) -> str:
    """获取当前用户 ID 作为限流键

    用于需要按用户维度限流的接口（如 AI 生成接口）。
    依赖 auth_service 中 get_current_user 注入的 current_user state。
    """
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    # 如果没有用户信息，回退到 IP
    return f"ip:{get_remote_address(request)}"


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """限流异常处理器

    返回统一格式的 429 错误响应。
    """
    return JSONResponse(
        status_code=429,
        content={
            "detail": "请求过于频繁，请稍后再试",
            "code": "RATE_LIMIT_EXCEEDED",
        },
    )
