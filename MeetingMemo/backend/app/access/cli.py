import argparse
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from alembic.config import Config

from alembic import command
from app.access.service import AccessService
from app.core.config import Settings, get_settings
from app.core.database import create_database_engine, create_session_factory


def parse_expiration(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create a MeetingMemo invitation code")
    parser.add_argument("--label", required=True)
    parser.add_argument("--max-redemptions", type=int, default=50)
    parser.add_argument("--expires-at", type=parse_expiration)
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
    created = service.create_invite(
        label=args.label,
        max_redemptions=args.max_redemptions,
        expires_at=args.expires_at,
    )
    print(f"INVITE_ID={created.id}")
    print(f"INVITE_CODE={created.code}")
    return 0
