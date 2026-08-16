import shutil
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from src.api.app import create_app
from src.graphs.chat.backends import DEFAULT_WORKSPACE_DIR


@pytest.fixture
def test_session_id():
    return "test-session-artifact-123"


@pytest.fixture(autouse=True)
def setup_test_artifacts(test_session_id):
    # Setup test workspace
    workspace = (DEFAULT_WORKSPACE_DIR / test_session_id).resolve()
    workspace.mkdir(parents=True, exist_ok=True)

    # Create dummy artifact files
    (workspace / "chart.png").write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
    (workspace / "data.csv").write_text("id,val\n1,100\n2,200", encoding="utf-8")
    (workspace / "report.json").write_text('{"summary": "ok"}', encoding="utf-8")
    (workspace / "plot.html").write_text("<div>Chart Plot</div>", encoding="utf-8")

    yield workspace

    # Teardown
    if workspace.exists():
        shutil.rmtree(workspace)


@pytest.mark.asyncio
async def test_get_session_artifact_success(test_session_id):
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # PNG
        res_png = await ac.get(f"/sessions/{test_session_id}/artifacts/chart.png")
        assert res_png.status_code == 200
        assert "image/png" in res_png.headers.get("content-type", "")

        # CSV
        res_csv = await ac.get(f"/sessions/{test_session_id}/artifacts/data.csv")
        assert res_csv.status_code == 200
        assert "text/csv" in res_csv.headers.get("content-type", "")
        assert "1,100" in res_csv.text

        # JSON
        res_json = await ac.get(f"/sessions/{test_session_id}/artifacts/report.json")
        assert res_json.status_code == 200
        assert "application/json" in res_json.headers.get("content-type", "")

        # HTML
        res_html = await ac.get(f"/sessions/{test_session_id}/artifacts/plot.html")
        assert res_html.status_code == 200
        assert "text/html" in res_html.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_get_session_artifact_not_found(test_session_id):
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/sessions/{test_session_id}/artifacts/missing.png")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_session_artifact_path_traversal_blocked(test_session_id):
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Denied hidden/env file
        res_env = await ac.get(f"/sessions/{test_session_id}/artifacts/.env")
        assert res_env.status_code == 403

        # Traversal with url-encoded dots
        res_traversal = await ac.get(f"/sessions/{test_session_id}/artifacts/%2e%2e%2fsecret.txt")
        assert res_traversal.status_code in (403, 404)
