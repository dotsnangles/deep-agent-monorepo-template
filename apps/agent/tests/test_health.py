from fastapi.testclient import TestClient
from src.controllers.app import create_app


def test_health_endpoints():
    app = create_app()
    with TestClient(app) as client:
        # 1. Root endpoint
        root_res = client.get("/")
        assert root_res.status_code == 200
        root_data = root_res.json()
        assert root_data["status"] == "running"
        assert root_data["framework"] == "LangChain deepagents + AG-UI"

        # 2. Health endpoint
        health_res = client.get("/health")
        assert health_res.status_code == 200
        health_data = health_res.json()
        assert health_data["status"] == "healthy"
        assert health_data["framework"] == "deepagents"
