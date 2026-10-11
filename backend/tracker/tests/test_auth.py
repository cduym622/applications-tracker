from datetime import timedelta

import pytest
from django.core.cache import cache
from rest_framework_simplejwt.tokens import AccessToken

from tracker.models import User

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db

REGISTER = "/api/auth/register/"
LOGIN = "/api/auth/login/"


@pytest.fixture(autouse=True)
def clear_throttle():
    # Throttle counts live in the cache. Start each test with a full allowance.
    cache.clear()


def register(client, email, password=PASSWORD):
    return client.post(REGISTER, {"email": email, "password": password}, format="json")


def login(client, email, password=PASSWORD):
    return client.post(LOGIN, {"email": email, "password": password}, format="json")


def test_register_returns_201_and_only_an_access_token(api_client):
    response = register(api_client, "me@example.com")

    assert response.status_code == 201
    assert list(response.json()) == ["access"]
    assert User.objects.filter(email="me@example.com").exists()


def test_login_returns_200_and_only_an_access_token(api_client, user):
    response = login(api_client, user.email)

    assert response.status_code == 200
    assert list(response.json()) == ["access"]


def test_duplicate_email_in_another_case_is_400(api_client):
    register(api_client, "me@example.com")

    response = register(api_client, "Me@Example.com")

    assert response.status_code == 400
    assert response.json() == {"email": ["A user with this email already exists."]}


def test_short_password_is_400_on_password(api_client):
    response = register(api_client, "me@example.com", password="short1")

    assert response.status_code == 400
    assert list(response.json()) == ["password"]


def test_common_password_is_400_on_password(api_client):
    response = register(api_client, "me@example.com", password="password")

    assert response.status_code == 400
    assert list(response.json()) == ["password"]


def test_login_with_unknown_email_is_401(api_client):
    response = login(api_client, "nobody@example.com")

    assert response.status_code == 401
    assert response.json() == {"detail": "Email or password is incorrect."}


def test_login_with_wrong_password_is_401(api_client, user):
    response = login(api_client, user.email, password="not-the-passphrase")

    assert response.status_code == 401
    assert response.json() == {"detail": "Email or password is incorrect."}


def test_missing_token_is_401(api_client):
    response = api_client.get("/api/applications/")

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication credentials were not provided."}


def token_not_valid(message):
    return {
        "detail": "Given token not valid for any token type",
        "code": "token_not_valid",
        "messages": [{"token_class": "AccessToken", "token_type": "access", "message": message}],
    }


def test_expired_token_is_401_with_simplejwt_body(api_client, user):
    token = AccessToken.for_user(user)
    token.set_exp(lifetime=-timedelta(hours=1))
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/dashboard/")

    assert response.status_code == 401
    assert response.json() == token_not_valid("Token is expired")


def test_malformed_token_is_401_with_simplejwt_body(api_client):
    api_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-jwt")

    response = api_client.get("/api/dashboard/")

    assert response.status_code == 401
    assert response.json() == token_not_valid("Token is invalid")


def test_eleventh_register_is_throttled_and_login_is_not(api_client, user):
    for i in range(10):
        assert register(api_client, f"user{i}@example.com").status_code == 201

    response = register(api_client, "user10@example.com")

    assert response.status_code == 429
    assert response.json()["detail"].startswith("Request was throttled.")
    assert login(api_client, user.email).status_code != 429


def test_eleventh_login_is_throttled_and_register_is_not(api_client, user):
    for _ in range(10):
        assert login(api_client, user.email).status_code == 200

    response = login(api_client, user.email)

    assert response.status_code == 429
    assert response.json()["detail"].startswith("Request was throttled.")
    assert register(api_client, "new@example.com").status_code != 429
