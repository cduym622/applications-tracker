from datetime import date

import pytest

from tracker.models import Status

pytestmark = pytest.mark.django_db

LIST = "/api/applications/"


def ids(response):
    return [row["id"] for row in response.json()["results"]]


def test_q_matches_job_title_ignoring_case(auth_client, user, make_application):
    match = make_application(user, job_title="Senior Backend Engineer")
    make_application(user, job_title="Data analyst")

    response = auth_client.get(LIST, {"q": "backend"})

    assert response.status_code == 200
    assert ids(response) == [match.id]


def test_q_matches_company_name_ignoring_case(auth_client, user, make_application):
    match = make_application(user, company_name="Northwind", job_title="Engineer")
    make_application(user, company_name="Contoso", job_title="Engineer")

    response = auth_client.get(LIST, {"q": "NORTH"})

    assert ids(response) == [match.id]


def test_q_that_matches_nothing_returns_an_empty_page(auth_client, user, make_application):
    make_application(user)

    response = auth_client.get(LIST, {"q": "zzz"})

    assert response.status_code == 200
    assert response.json()["count"] == 0
    assert response.json()["results"] == []


@pytest.fixture
def dated(user, make_application):
    """One application before, on, inside, on the end of, and after 2026-10-01..2026-10-10, plus one with no date."""
    return {
        "before": make_application(user, date_applied=date(2026, 9, 30)),
        "from": make_application(user, date_applied=date(2026, 10, 1)),
        "inside": make_application(user, date_applied=date(2026, 10, 5)),
        "to": make_application(user, date_applied=date(2026, 10, 10)),
        "after": make_application(user, date_applied=date(2026, 10, 11)),
        "none": make_application(user, date_applied=None),
    }


def test_date_range_keeps_both_bounds_and_drops_undated(auth_client, dated):
    response = auth_client.get(LIST, {"from": "2026-10-01", "to": "2026-10-10"})

    assert ids(response) == [dated["to"].id, dated["inside"].id, dated["from"].id]


def test_from_alone_drops_undated(auth_client, dated):
    response = auth_client.get(LIST, {"from": "2026-10-10"})

    assert ids(response) == [dated["after"].id, dated["to"].id]


def test_to_alone_drops_undated(auth_client, dated):
    response = auth_client.get(LIST, {"to": "2026-10-01"})

    assert ids(response) == [dated["from"].id, dated["before"].id]


def test_no_date_bounds_keeps_undated(auth_client, dated):
    response = auth_client.get(LIST, {"from": "", "to": ""})

    assert response.status_code == 200
    assert dated["none"].id in ids(response)
    assert response.json()["count"] == 6


def test_status_keeps_one_status(auth_client, user, make_application):
    applied = make_application(user, status=Status.APPLIED)
    make_application(user, status=Status.SAVED)
    make_application(user, status=Status.OFFER)

    response = auth_client.get(LIST, {"status": "APPLIED"})

    assert ids(response) == [applied.id]


@pytest.mark.parametrize(
    "params, field",
    [
        ({"status": "HIRED"}, "status"),
        ({"from": "2026-13-01"}, "from"),
        ({"to": "yesterday"}, "to"),
        ({"from": "2026-10-10", "to": "2026-10-01"}, "from"),
    ],
)
def test_invalid_query_is_400_on_that_parameter(auth_client, params, field):
    response = auth_client.get(LIST, params)

    assert response.status_code == 400
    assert list(response.json()) == [field]


def test_page_size_is_ten_and_cannot_be_changed(auth_client, user, make_application):
    for _ in range(11):
        make_application(user)

    first = auth_client.get(LIST, {"page_size": 50})
    second = auth_client.get(LIST, {"page": 2, "page_size": 50})

    assert first.json()["count"] == 11
    assert len(first.json()["results"]) == 10
    assert len(second.json()["results"]) == 1


def test_order_is_date_desc_undated_last_then_id_desc(auth_client, user, make_application):
    undated_old = make_application(user, date_applied=None)
    older = make_application(user, date_applied=date(2026, 9, 1))
    same_date_low = make_application(user, date_applied=date(2026, 10, 1))
    same_date_high = make_application(user, date_applied=date(2026, 10, 1))
    undated_new = make_application(user, date_applied=None)

    response = auth_client.get(LIST)

    assert ids(response) == [same_date_high.id, same_date_low.id, older.id, undated_new.id, undated_old.id]


def test_page_past_the_end_is_404(auth_client, user, make_application):
    make_application(user)

    response = auth_client.get(LIST, {"page": 3})

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}
