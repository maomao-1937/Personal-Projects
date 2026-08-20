import asyncio
from uuid import uuid4

import httpx

from app.domain import Material
from app.main import create_app
from app.model_gateway import HeuristicModelGateway, ModelGatewayInvalidResponse


def test_web_app_shell_and_styles_are_served() -> None:
    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=HeuristicModelGateway(),
        api_token="test-secret",
    )
    assert app.title == "灵感星图"

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            page = await client.get("/")
            assert page.status_code == 200
            assert "<title>灵感星图</title>" in page.text
            assert "灵感星图" in page.text
            assert "私人项目孵化箱" not in page.text
            assert "/assets/styles.css" in page.text
            assert 'id="organizedMaterialContent"' in page.text
            assert 'id="materialInlineStatus"' in page.text
            assert "连接 HY3" not in page.text
            assert "modelApiKey" not in page.text

            styles = await client.get("/assets/styles.css")
            assert styles.status_code == 200
            assert "#030014" in styles.text

            script = await client.get("/assets/app.js")
            assert script.status_code == 200
            assert "HY3" not in script.text
            assert "X-Model-API-Key" not in script.text

    asyncio.run(scenario())


def test_homepage_uses_silver_core_galaxy_with_half_speed_wings() -> None:
    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=HeuristicModelGateway(),
        api_token="test-secret",
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            page = await client.get("/")
            styles = await client.get("/assets/styles.css")

            assert 'class="hero-galaxy"' in page.text
            assert 'class="galaxy-core"' in page.text
            assert 'class="galaxy-wing galaxy-wing-a"' in page.text
            assert 'class="galaxy-wing galaxy-wing-b"' in page.text
            assert 'class="black-hole"' not in page.text
            assert "animation: galaxy-wing-spin 48s linear infinite" in styles.text
            assert "@media (prefers-reduced-motion: reduce)" in styles.text

    asyncio.run(scenario())


def test_homepage_uses_material_seed_picker() -> None:
    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=HeuristicModelGateway(),
        api_token="test-secret",
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            page = await client.get("/")
            script = await client.get("/assets/app.js")

            assert 'aria-label="散落的念头、网页和问题存进来。"' in page.text
            assert 'id="projectQuery"' not in page.text
            assert 'id="projectSeedButton"' in page.text
            assert 'id="projectSeedList"' in page.text
            assert 'id="projectSeedHint"' in page.text
            assert 'id="generateHypothesisButton"' in page.text
            assert "seed_material_id" in script.text
            assert "projectQuery" not in script.text

    asyncio.run(scenario())


def test_material_to_hypothesis_and_feedback_flow() -> None:
    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=HeuristicModelGateway(),
        api_token="test-secret",
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            headers = {"Authorization": "Bearer test-secret"}
            material_ids = []
            for content in ("收藏从不回看", "滑动筛选很轻松"):
                response = await client.post(
                    "/materials",
                    headers=headers,
                    json={"source_type": "text", "content": content},
                )
                assert response.status_code == 201
                material_ids.append(response.json()["id"])

            response = await client.post(
                "/incubations",
                headers=headers,
                json={"seed_material_id": material_ids[0]},
            )
            assert response.status_code == 201
            hypothesis = response.json()
            assert hypothesis["status"] == "ready"
            assert len(hypothesis["source_contributions"]) >= 2
            assert material_ids[0] in {
                item["material_id"] for item in hypothesis["source_contributions"]
            }

            response = await client.post(
                f"/hypotheses/{hypothesis['id']}/feedback",
                headers=headers,
                json={"category": "worth_doing", "note": "准备周末试试"},
            )
            assert response.status_code == 201
            assert response.json()["category"] == "worth_doing"

            spoofed = await client.get(
                "/materials",
                headers={
                    "Authorization": "Bearer test-secret",
                    "X-User-ID": "another-user",
                },
            )
            assert len(spoofed.json()) == 2

    asyncio.run(scenario())


def test_incubation_rejects_invalid_seed_material() -> None:
    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=HeuristicModelGateway(),
        api_token="test-secret",
    )
    processing = app.state.repository.add_material(
        Material(
            user_id="owner",
            source_type="text",
            raw_text="still processing",
            processing_status="processing",
        )
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            headers = {"Authorization": "Bearer test-secret"}
            missing = await client.post(
                "/incubations",
                headers=headers,
                json={"seed_material_id": str(uuid4())},
            )
            not_ready = await client.post(
                "/incubations",
                headers=headers,
                json={"seed_material_id": str(processing.id)},
            )

            assert missing.status_code == 404
            assert not_ready.status_code == 400

    asyncio.run(scenario())


def test_business_routes_require_user_header() -> None:
    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=HeuristicModelGateway(),
        api_token="test-secret",
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.get("/materials")
            assert response.status_code == 401

            spoofed = await client.get("/materials", headers={"X-User-ID": "victim"})
            assert spoofed.status_code == 401

    asyncio.run(scenario())


def test_model_failures_return_stable_gateway_error() -> None:
    class BrokenGateway(HeuristicModelGateway):
        def analyze_material(self, content: str):
            raise ModelGatewayInvalidResponse("invalid model output")

    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=BrokenGateway(),
        api_token="test-secret",
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/materials",
                headers={"Authorization": "Bearer test-secret"},
                json={"source_type": "text", "content": "saved content"},
            )
            assert response.status_code == 502
            assert response.json() == {"detail": "内置 AI 返回结果异常，请重试"}

    asyncio.run(scenario())


def test_server_managed_model_is_generic_and_material_can_be_edited() -> None:
    class BuiltInGateway(HeuristicModelGateway):
        model_name = "private-provider-version"

    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=BuiltInGateway(),
        api_token="test-secret",
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            headers = {
                "Authorization": "Bearer test-secret",
            }

            created = await client.post(
                "/materials",
                headers=headers,
                json={"source_type": "text", "title": "旧标题", "content": "露营清单"},
            )
            assert created.status_code == 201
            assert created.json()["model_name"] == "built-in-ai"
            material_id = created.json()["id"]

            detail = await client.get(f"/materials/{material_id}", headers=headers)
            assert detail.status_code == 200
            updated = await client.post(
                f"/materials/{material_id}/update",
                headers=headers,
                json={"title": "新标题", "content": "家庭露营按角色分工"},
            )
            assert updated.status_code == 200
            assert updated.json()["title"] == "新标题"
            assert updated.json()["id"] == material_id
            assert updated.json()["raw_text"] == "家庭露营按角色分工"
            assert updated.json()["organized_text"] == "家庭露营按角色分工"

            reanalyzed = await client.post(
                f"/materials/{material_id}/reanalyze", headers=headers
            )
            assert reanalyzed.status_code == 200
            assert reanalyzed.json()["raw_text"] == "家庭露营按角色分工"
            assert reanalyzed.json()["organized_text"]
            assert reanalyzed.json()["model_name"] == "built-in-ai"

            openapi = await client.get("/openapi.json")
            assert "/model/test" not in openapi.json()["paths"]

    asyncio.run(scenario())
