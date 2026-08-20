"""配置层。从 .env 读取,所有路径解析为绝对路径。密钥只在此处加载,不回显。"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# shipcheck/backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 混元(OpenAI 兼容接口)
    hunyuan_api_key: str = ""
    hunyuan_base_url: str = "https://api.hunyuan.cloud.tencent.com/v1"
    hunyuan_model: str = "hunyuan-turbos-latest"
    hunyuan_vision_model: str = "hunyuan-vision-latest"

    # 应用
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # 数据
    db_url: str = "sqlite:///./data/shipcheck.db"
    data_dir: str = "./data"
    screenshot_dir: str = "./data/screenshots"

    # Agent 边界
    max_steps_per_item: int = 15
    item_timeout_seconds: int = 60
    max_total_steps: int = 30
    llm_max_retries: int = 2

    # Mock 模式(开发期/测试期)
    mock_mode: bool = True

    @property
    def abs_data_dir(self) -> Path:
        p = Path(self.data_dir)
        return p.resolve() if p.is_absolute() else (BASE_DIR / p).resolve()

    @property
    def abs_screenshot_dir(self) -> Path:
        p = Path(self.screenshot_dir)
        return p.resolve() if p.is_absolute() else (BASE_DIR / p).resolve()

    @property
    def abs_db_url(self) -> str:
        # SQLite 相对路径转绝对,便于 cwd 无关
        if self.db_url.startswith("sqlite:///"):
            path_part = self.db_url[len("sqlite:///"):]
            p = Path(path_part)
            if not p.is_absolute():
                p = (BASE_DIR / p).resolve()
                return f"sqlite:///{p}"
        return self.db_url


settings = Settings()


def ensure_dirs() -> None:
    """启动时确保数据目录存在。"""
    settings.abs_data_dir.mkdir(parents=True, exist_ok=True)
    settings.abs_screenshot_dir.mkdir(parents=True, exist_ok=True)
