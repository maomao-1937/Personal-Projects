import asyncio

import httpx
import pytest

from app.main import create_app
from app.model_gateway import HeuristicModelGateway


@pytest.mark.parametrize("body", ["", " \r\n\t", "\u3000"])
def test_empty_webpage_is_rejected_before_analysis_or_storage(monkeypatch, body):
    class RecordingGateway(HeuristicModelGateway):
        def __init__(self):
            self.calls = []

        def analyze_material(self, content):
            self.calls.append(content)
            return super().analyze_material(content)

    monkeypatch.setattr("app.ingestion.HttpUrlFetcher.fetch", lambda self, url: body)
    gateway = RecordingGateway()
    app = create_app(database_url="sqlite+pysqlite:///:memory:", model_gateway=gateway, api_token="test-secret")

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", headers={"Authorization": "Bearer test-secret"}) as client:
            saved = await client.post("/materials", json={"source_type": "text", "content": "原有素材应当保留。"})
            assert saved.status_code == 201
            before = (await client.get("/materials")).json()
            response = await client.post("/materials", json={"source_type": "url", "source_url": "https://example.com/empty"})
            assert response.status_code == 422, response.text
            assert "空" in response.json()["detail"]
            assert gateway.calls == ["原有素材应当保留。"]
            assert (await client.get("/materials")).json() == before

    try:
        asyncio.run(scenario())
    finally:
        app.state.repository.close()
