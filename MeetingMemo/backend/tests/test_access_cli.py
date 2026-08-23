from sqlalchemy import select

from app.access.cli import run as run_create
from app.access.deactivate_cli import run as run_deactivate
from app.access.models import InviteCode


def test_create_invite_cli_outputs_plaintext_once(
    app, settings, session_factory, capsys, monkeypatch
):
    monkeypatch.setattr(
        "app.access.service.generate_invite_code",
        lambda: "MM-PILOT-ACCESS-CODE",
    )
    exit_code = run_create(
        [
            "--label",
            "pilot",
            "--max-redemptions",
            "3",
        ],
        settings=settings,
    )

    assert exit_code == 0
    output = capsys.readouterr().out
    assert output.count("MM-PILOT-ACCESS-CODE") == 1
    with session_factory() as session:
        invite = session.scalar(select(InviteCode).where(InviteCode.label == "pilot"))
        assert invite is not None
        assert invite.max_redemptions == 3
        assert "MM-PILOT-ACCESS-CODE" not in invite.code_hash


def test_invite_can_be_deactivated_by_identifier(app, settings, session_factory, capsys):
    created = run_create(
        ["--label", "temporary", "--max-redemptions", "1"],
        settings=settings,
    )
    assert created == 0
    output = capsys.readouterr().out
    invite_id = next(
        line.removeprefix("INVITE_ID=")
        for line in output.splitlines()
        if line.startswith("INVITE_ID=")
    )

    exit_code = run_deactivate(["--invite-id", invite_id], settings=settings)

    assert exit_code == 0
    with session_factory() as session:
        invite = session.get(InviteCode, invite_id)
    assert invite is not None
    assert invite.is_active is False
