from unittest import mock

import pytest
from django.db import Error as DatabaseError

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("path", ["/api/health/", "/api/health/live/"])
def test_health_routes_are_ok_with_no_token(api_client, path):
    response = api_client.get(path)

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_failure_is_503_and_live_stays_200(api_client):
    # Postgres.app stays up. Only the health view's cursor fails.
    with mock.patch("tracker.views.connection.cursor", side_effect=DatabaseError("connection refused")):
        health = api_client.get("/api/health/")
        live = api_client.get("/api/health/live/")

    assert health.status_code == 503
    assert health.json() == {"status": "error"}
    assert live.status_code == 200
    assert live.json() == {"status": "ok"}
