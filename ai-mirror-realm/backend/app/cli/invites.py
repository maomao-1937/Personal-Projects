from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from typing import Optional

from app.database import Base, SessionLocal, engine
from app.models.invitation import InvitationToken
from app.services.invitation_service import (
    create_invitation,
    ensure_invitation_schema,
    revoke_invitation,
)


def _parse_duration(value: str) -> timedelta:
    if len(value) < 2 or not value[:-1].isdigit():
        raise argparse.ArgumentTypeError("有效期格式应为 24h、7d 或 4w")
    amount = int(value[:-1])
    unit = value[-1].lower()
    if amount <= 0:
        raise argparse.ArgumentTypeError("有效期必须大于 0")
    if unit == "h":
        return timedelta(hours=amount)
    if unit == "d":
        return timedelta(days=amount)
    if unit == "w":
        return timedelta(weeks=amount)
    raise argparse.ArgumentTypeError("有效期仅支持 h、d、w")


def _expires_at(duration: Optional[timedelta]) -> Optional[datetime]:
    return datetime.utcnow() + duration if duration else None


def create_command(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        created = []
        for _ in range(args.count):
            raw_token, invitation = create_invitation(
                db,
                label=args.label,
                expires_at=_expires_at(args.expires_in),
            )
            created.append((invitation.id, raw_token))
        db.commit()

    print("以下邀请码只显示一次，请立即妥善保存：")
    for invitation_id, raw_token in created:
        print(f"{invitation_id}\t{raw_token}")
    return 0


def list_command(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        invitations = (
            db.query(InvitationToken)
            .order_by(InvitationToken.created_at.desc())
            .all()
        )

    print("ID\t末四位\t状态\t过期时间\t标签")
    now = datetime.utcnow()
    for invitation in invitations:
        if invitation.redeemed_at:
            state = "已使用"
        elif invitation.revoked_at:
            state = "已撤销"
        elif invitation.expires_at and invitation.expires_at <= now:
            state = "已过期"
        else:
            state = "可用"
        expires_at = invitation.expires_at.isoformat() if invitation.expires_at else "永久"
        print(
            f"{invitation.id}\t…{invitation.token_hint}\t{state}\t"
            f"{expires_at}\t{invitation.label or '-'}"
        )
    return 0


def revoke_command(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        revoked = revoke_invitation(db, args.invitation_id)
        db.commit()
    if not revoked:
        print("邀请码不存在、已撤销或已被使用")
        return 1
    print(f"已撤销邀请码：{args.invitation_id}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AI 镜界邀请码管理")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="创建一次性邀请码")
    create_parser.add_argument("--count", type=int, default=1)
    create_parser.add_argument("--expires-in", type=_parse_duration)
    create_parser.add_argument("--label")
    create_parser.set_defaults(handler=create_command)

    list_parser = subparsers.add_parser("list", help="查看邀请码状态")
    list_parser.set_defaults(handler=list_command)

    revoke_parser = subparsers.add_parser("revoke", help="撤销未使用的邀请码")
    revoke_parser.add_argument("invitation_id")
    revoke_parser.set_defaults(handler=revoke_command)
    return parser


def main() -> int:
    Base.metadata.create_all(bind=engine)
    ensure_invitation_schema(engine)
    parser = build_parser()
    args = parser.parse_args()
    if getattr(args, "count", 1) < 1 or getattr(args, "count", 1) > 100:
        parser.error("--count 必须在 1 到 100 之间")
    if getattr(args, "label", None) and len(args.label) > 120:
        parser.error("--label 最长 120 个字符")
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
