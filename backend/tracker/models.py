from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower
from django.utils import timezone


def normalize_email(email):
    # The whole address is lowercased, so Chris@x.com and chris@x.com are one account.
    return email.strip().lower()


class UserManager(BaseUserManager):
    def create_user(self, email, password):
        user = self.model(email=normalize_email(email))
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    # No PermissionsMixin or is_staff: the API has no admin and no group permissions.
    email = models.EmailField(unique=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Company(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="companies")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Case-insensitive, so one user cannot have both Stripe and stripe.
            models.UniqueConstraint(Lower("name"), "user", name="unique_company_name_per_user"),
        ]

    def __str__(self):
        return self.name


class Status(models.TextChoices):
    SAVED = "SAVED"
    APPLIED = "APPLIED"
    SCREENING = "SCREENING"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class InterviewType(models.TextChoices):
    PHONE = "PHONE"
    VIDEO = "VIDEO"
    ONSITE = "ONSITE"


class Outcome(models.TextChoices):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    PASSED = "PASSED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Application(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="applications")
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="applications")
    job_title = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.SAVED)
    salary = models.CharField(max_length=255, null=True, blank=True)
    job_posting_url = models.URLField(max_length=2000, null=True, blank=True)
    date_applied = models.DateField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=[s.value for s in Status]),
                name="application_status_valid",
            ),
        ]
        indexes = [
            # Dashboard counts and the status filter.
            models.Index(fields=["user", "status"], name="application_user_status_idx"),
            # Default list order and the applied-date filter.
            models.Index(
                F("user"),
                F("date_applied").desc(nulls_last=True),
                F("id").desc(),
                name="application_list_idx",
            ),
        ]

    def __str__(self):
        return self.job_title


class Interview(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="interviews")
    scheduled_at = models.DateTimeField()
    type = models.CharField(max_length=6, choices=InterviewType.choices)
    outcome = models.CharField(max_length=9, choices=Outcome.choices, default=Outcome.SCHEDULED)
    round_name = models.CharField(max_length=255, null=True, blank=True)
    interviewer_name = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(type__in=[t.value for t in InterviewType]),
                name="interview_type_valid",
            ),
            models.CheckConstraint(
                condition=Q(outcome__in=[o.value for o in Outcome]),
                name="interview_outcome_valid",
            ),
        ]
        indexes = [
            # Next interview per application and the dashboard's upcoming list.
            models.Index(fields=["application", "scheduled_at"], name="interview_app_scheduled_idx"),
        ]


class Note(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="notes")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    # Not auto_now: it moves only when text changes, which the serializer decides.
    updated_at = models.DateTimeField(default=timezone.now)
