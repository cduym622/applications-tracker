from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from tracker.models import Application, Company, Interview, InterviewType, Note, User

PASSWORD = "a-long-passphrase"


@pytest.fixture
def api_client():
    """No token. For public routes and the 401 cases."""
    return APIClient()


@pytest.fixture
def make_user(db):
    # create_user, not the register endpoint: register is throttled to 10 a minute.
    def make(email):
        return User.objects.create_user(email, PASSWORD)

    return make


@pytest.fixture
def user(make_user):
    return make_user("alice@example.com")


@pytest.fixture
def other_user(make_user):
    return make_user("bob@example.com")


@pytest.fixture
def client_for(db):
    """A client signed in as the given user with a Bearer token."""

    def make(user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
        return client

    return make


@pytest.fixture
def auth_client(client_for, user):
    return client_for(user)


@pytest.fixture
def make_company(db):
    def make(user, name="Northwind"):
        return Company.objects.create(user=user, name=name)

    return make


@pytest.fixture
def make_application(db):
    """Create an application through the ORM. A company is created for it unless one is passed."""

    def make(user, company=None, **fields):
        if company is None:
            company = Company.objects.get_or_create(user=user, name=fields.pop("company_name", "Northwind"))[0]
        fields.setdefault("job_title", "Backend engineer")
        fields.setdefault("location", "Remote")
        return Application.objects.create(user=user, company=company, **fields)

    return make


@pytest.fixture
def make_interview(db):
    def make(application, **fields):
        fields.setdefault("scheduled_at", timezone.now() + timedelta(hours=1))
        fields.setdefault("type", InterviewType.VIDEO)
        return Interview.objects.create(application=application, **fields)

    return make


@pytest.fixture
def make_note(db):
    def make(application, text="First call went well."):
        return Note.objects.create(application=application, text=text)

    return make


@pytest.fixture
def application(user, make_application):
    return make_application(user)
