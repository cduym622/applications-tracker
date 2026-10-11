from datetime import timedelta

import pytest
from django.utils import timezone

from tracker.models import Outcome, Status

pytestmark = pytest.mark.django_db

DASHBOARD = "/api/dashboard/"


def upcoming_ids(response):
    return [item["id"] for item in response.json()["upcoming_interviews"]]


def test_counts_include_every_status_with_zeros(auth_client, user, make_application):
    make_application(user, status=Status.APPLIED)
    make_application(user, status=Status.APPLIED)
    make_application(user, status=Status.OFFER)

    response = auth_client.get(DASHBOARD)

    assert response.status_code == 200
    assert response.json()["counts"] == {
        "SAVED": 0,
        "APPLIED": 2,
        "SCREENING": 0,
        "INTERVIEW": 0,
        "OFFER": 1,
        "REJECTED": 0,
        "WITHDRAWN": 0,
    }


def test_counts_leave_out_other_users(auth_client, other_user, make_application):
    make_application(other_user, status=Status.APPLIED)

    response = auth_client.get(DASHBOARD)

    assert response.json()["counts"]["APPLIED"] == 0


def test_upcoming_keeps_only_future_scheduled_interviews_of_the_caller(
    auth_client, application, other_user, make_application, make_interview
):
    now = timezone.now()
    upcoming = make_interview(application, scheduled_at=now + timedelta(hours=1))
    make_interview(application, scheduled_at=now - timedelta(hours=1))
    make_interview(application, scheduled_at=now + timedelta(hours=2), outcome=Outcome.CANCELLED)
    make_interview(make_application(other_user), scheduled_at=now + timedelta(hours=1))

    response = auth_client.get(DASHBOARD)

    assert upcoming_ids(response) == [upcoming.id]


def test_upcoming_returns_the_soonest_ten_with_ties_by_lower_id(auth_client, application, make_interview):
    now = timezone.now()
    # Created latest-first, so id order and time order disagree.
    by_time = [make_interview(application, scheduled_at=now + timedelta(hours=h)) for h in range(9, 0, -1)][::-1]
    tie_time = now + timedelta(hours=10)
    tie_low = make_interview(application, scheduled_at=tie_time)
    tie_high = make_interview(application, scheduled_at=tie_time)

    response = auth_client.get(DASHBOARD)

    assert upcoming_ids(response) == [i.id for i in by_time] + [tie_low.id]
    assert tie_high.id not in upcoming_ids(response)


def test_upcoming_item_fields(auth_client, user, make_application, make_interview):
    application = make_application(user, job_title="Platform engineer", company_name="Contoso")
    interview = make_interview(application, type="ONSITE")

    item = auth_client.get(DASHBOARD).json()["upcoming_interviews"][0]

    assert item["job_title"] == "Platform engineer"
    assert item["company_name"] == "Contoso"
    assert item["type"] == "ONSITE"
    assert item["application_id"] == application.id
    assert item["id"] == interview.id
    assert "scheduled_at" in item
