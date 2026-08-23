from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

from app.models import AnalysisAttempt, Feedback, InviteCode
from tests.integration.test_analysis_service import build_context, valid_request


def test_database_never_contains_transcript_report_or_reply(tmp_path: Path) -> None:
    service, _, _, factory, invite_id, engine = build_context(tmp_path)

    service.analyze(invite_id, str(uuid4()), valid_request())

    with factory() as session:
        persisted = [
            *session.execute(select(InviteCode)).all(),
            *session.execute(select(AnalysisAttempt)).all(),
            *session.execute(select(Feedback)).all(),
        ]
    database_dump = repr(persisted)
    assert "这个价格有些贵" not in database_dump
    assert "我们已经是最低价格了" not in database_dump
    assert "方便说说您主要在比较哪些方面吗" not in database_dump
    assert "存在可定位的改进空间" not in database_dump
    engine.dispose()
