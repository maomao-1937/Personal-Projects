import os
import sys
from pathlib import Path


def _prefer_modern_sqlite() -> None:
    if sys.platform != "linux":
        return
    try:
        import pysqlite3
    except ImportError:
        return
    sys.modules["sqlite3"] = pysqlite3


def main() -> None:
    _prefer_modern_sqlite()

    from alembic.config import Config

    from alembic import command
    from app.access.bootstrap import ensure_bootstrap_invite
    from app.core.config import Settings
    from app.core.database import create_database_engine, create_session_factory

    settings = Settings()
    bootstrap_code = os.getenv("BOOTSTRAP_INVITE_CODE", "")

    alembic_config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    alembic_config.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_config, "head")

    engine = create_database_engine(settings.database_url)
    try:
        ensure_bootstrap_invite(
            settings=settings,
            session_factory=create_session_factory(engine),
            code=bootstrap_code,
            label="vefaas-demo",
        )
    finally:
        engine.dispose()

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        access_log=False,
    )


if __name__ == "__main__":
    main()
