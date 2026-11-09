import asyncio
from threading import Event

import httpx
import pytest

from app.main import create_app
from app.model_gateway import HeuristicModelGateway


@pytest.mark.parametrize("changed_text", ["原始素材", "更新后的素材"])
def test_slow_reanalysis_preserves_a_newer_edit(tmp_path, changed_text):
    started = Event()
    resume = Event()
    hold_next = Event()

    class DelayedGateway(HeuristicModelGateway):
        def analyze_material(self, content):
            if hold_next.is_set():
                hold_next.clear()
                started.set()
                assert resume.wait(10), "test did not release the pending analysis"
            return super().analyze_material(content)

    app = create_app(
        database_url=f"sqlite+pysqlite:///{(tmp_path / 'materials.db').as_posix()}",
        model_gateway=DelayedGateway(),
        api_token="test-secret",
    )

    async def scenario():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": "Bearer test-secret"},
        ) as client:
            created = await client.post(
                "/materials", json={"source_type": "text", "content": "原始素材"}
            )
            assert created.status_code == 201
            path = f"/materials/{created.json()['id']}"
            hold_next.set()
            pending = asyncio.create_task(client.post(f"{path}/reanalyze"))
            try:
                assert await asyncio.to_thread(started.wait, 5)
                edited = await client.patch(
                    path, json={"title": "后来保存的标题", "content": changed_text}
                )
                assert edited.status_code == 200
            finally:
                resume.set()
                stale = await asyncio.wait_for(pending, timeout=10)
            stored = await client.get(path)
            assert stored.json()["title"] == "后来保存的标题"
            assert stored.json()["raw_text"] == changed_text
            assert stored.json() == edited.json()
            assert stale.status_code == 409
            retry = await client.post(f"{path}/reanalyze")
            assert retry.status_code == 200
            assert retry.json()["title"] == "后来保存的标题"
            assert retry.json()["raw_text"] == changed_text

    try:
        asyncio.run(scenario())
    finally:
        app.state.repository.close()
