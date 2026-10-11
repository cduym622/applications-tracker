"""Database rules the API cannot reach, because serializers reject bad values first and there is no company delete."""

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from tracker.models import Application, Company, Interview

pytestmark = pytest.mark.django_db


def test_application_status_check_constraint(application):
    # atomic, so the failed statement does not break the test's own transaction.
    with pytest.raises(IntegrityError), transaction.atomic():
        Application.objects.filter(pk=application.pk).update(status="HIRED")


def test_interview_type_check_constraint(application, make_interview):
    interview = make_interview(application)

    with pytest.raises(IntegrityError), transaction.atomic():
        Interview.objects.filter(pk=interview.pk).update(type="EMAIL")


def test_interview_outcome_check_constraint(application, make_interview):
    interview = make_interview(application)

    with pytest.raises(IntegrityError), transaction.atomic():
        Interview.objects.filter(pk=interview.pk).update(outcome="GHOSTED")


def test_company_name_is_unique_per_user_ignoring_case(user, make_company):
    make_company(user, "Stripe")

    with pytest.raises(IntegrityError), transaction.atomic():
        Company.objects.create(user=user, name="stripe")


def test_company_with_an_application_cannot_be_deleted(application):
    with pytest.raises(ProtectedError):
        application.company.delete()
