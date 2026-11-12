from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Welcome to Intelera DM Portal API",
        "status": "running",
        "environment": "development",
    }


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "application": "Intelera DM Portal API",
    }


def test_invalid_endpoint():
    response = client.get("/invalid-endpoint")

    assert response.status_code == 404