import argparse
from collections.abc import Sequence
from pathlib import Path

from alembic.config import Config

from alembic import command
from app.access.service import AccessService
from app.core.config import Settings, get_settings
from app.core.database import create_database_engine, create_session_factory


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Deactivate a MeetingMemo invitation code")
    parser.add_argument("--invite-id", required=True)
    return parser


def run(argv: Sequence[str] | None = None, *, settings: Settings | None = None) -> int:
    args = build_parser().parse_args(argv)
    resolved_settings = settings or get_settings()
    if settings is None:
        config = Config(str(Path(__file__).parents[2] / "alembic.ini"))
        config.set_main_option("sqlalchemy.url", resolved_settings.database_url)
        command.upgrade(config, "head")
    engine = create_database_engine(resolved_settings.database_url)
    service = AccessService(resolved_settings, create_session_factory(engine))
    service.deactivate_invite(args.invite_id)
    print(f"DEACTIVATED_INVITE_ID={args.invite_id}")
    return 0
