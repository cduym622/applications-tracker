from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Value
from django.db.models.functions import Lower
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Application, Company, Interview, Note, Status, User, normalize_email

DUPLICATE_EMAIL = "A user with this email already exists."


class BlankToNullMixin:
    """Optional string fields store null instead of a string that is blank after trimming."""

    def run_validation(self, data=serializers.empty):
        value = super().run_validation(data)
        return None if value == "" else value


class OptionalCharField(BlankToNullMixin, serializers.CharField):
    def __init__(self, **kwargs):
        super().__init__(required=False, allow_null=True, allow_blank=True, **kwargs)


class OptionalURLField(BlankToNullMixin, serializers.URLField):
    def __init__(self, **kwargs):
        super().__init__(required=False, allow_null=True, allow_blank=True, **kwargs)


class NeverPartialMixin:
    """For PATCH bodies whose fields are required: interview outcome and note text.

    DRF and drf-spectacular both set partial=True on PATCH, which would make
    the field optional at runtime and in the schema. This serializer ignores it.
    """

    @property
    def partial(self):
        return False

    @partial.setter
    def partial(self, value):
        pass


# Auth


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        email = normalize_email(value)
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(DUPLICATE_EMAIL)
        return email

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        # Two registers for one email can both pass validate_email. The unique
        # column stops the second, and it gets the same field error.
        try:
            with transaction.atomic():
                return User.objects.create_user(**validated_data)
        except IntegrityError:
            raise serializers.ValidationError({"email": [DUPLICATE_EMAIL]})


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class TokenSerializer(serializers.Serializer):
    access = serializers.CharField()


# Companies


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name"]


def find_or_create_company(user, name):
    """Return the user's company whose name matches ignoring case, creating it if none does.

    The caller holds a transaction, so a failed application save also drops a
    company created here.
    """
    # Same expression as unique_company_name_per_user, so a match here is
    # exactly what the constraint treats as a duplicate.
    companies = Company.objects.filter(user=user).alias(lower_name=Lower("name"))
    match = Lower(Value(name))
    company = companies.filter(lower_name=match).first()
    if company is not None:
        return company
    try:
        # Savepoint, so a lost race does not break the caller's transaction.
        with transaction.atomic():
            return Company.objects.create(user=user, name=name)
    except IntegrityError:
        # Another request created the same name first. Use its row.
        return companies.get(lower_name=match)


# Interviews


class InterviewSerializer(serializers.ModelSerializer):
    round_name = OptionalCharField(max_length=255)
    interviewer_name = OptionalCharField(max_length=255)

    class Meta:
        model = Interview
        fields = ["id", "scheduled_at", "type", "outcome", "round_name", "interviewer_name"]


class InterviewOutcomeSerializer(NeverPartialMixin, serializers.ModelSerializer):
    """PATCH body for an interview. Only outcome can change."""

    class Meta:
        model = Interview
        fields = ["outcome"]
        extra_kwargs = {"outcome": {"required": True}}

    def to_internal_value(self, data):
        # DRF ignores unknown keys by default. Here they are an error, so a
        # client cannot think it changed a field that stayed the same.
        errors = {}
        if isinstance(data, dict):
            errors = {key: ["This field cannot be changed."] for key in data if key not in self.fields}
        try:
            value = super().to_internal_value(data)
        except serializers.ValidationError as exc:
            errors.update(exc.detail)
        if errors:
            raise serializers.ValidationError(errors)
        return value


class NextInterviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = ["id", "scheduled_at", "type"]


# Applications


class ApplicationReadSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    next_interview = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id",
            "job_title",
            "company",
            "location",
            "status",
            "salary",
            "job_posting_url",
            "date_applied",
            "description",
            "next_interview",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(NextInterviewSerializer(allow_null=True))
    def get_next_interview(self, obj):
        # Views prefetch the soonest upcoming interview into `upcoming`, so a
        # page of applications does not run one query per row.
        upcoming = obj.upcoming
        return NextInterviewSerializer(upcoming[0]).data if upcoming else None


class ApplicationWriteSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(max_length=255, write_only=True)
    salary = OptionalCharField(max_length=255)
    job_posting_url = OptionalURLField(max_length=2000)
    description = OptionalCharField()

    class Meta:
        model = Application
        fields = [
            "job_title",
            "company_name",
            "location",
            "status",
            "salary",
            "job_posting_url",
            "date_applied",
            "description",
        ]

    def create(self, validated_data):
        name = validated_data.pop("company_name")
        with transaction.atomic():
            validated_data["company"] = find_or_create_company(validated_data["user"], name)
            return super().create(validated_data)

    def update(self, instance, validated_data):
        name = validated_data.pop("company_name", None)
        with transaction.atomic():
            if name is not None:
                validated_data["company"] = find_or_create_company(instance.user, name)
            return super().update(instance, validated_data)


# Notes


class NoteSerializer(NeverPartialMixin, serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ["id", "text", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def update(self, instance, validated_data):
        if validated_data.get("text", instance.text) != instance.text:
            instance.updated_at = timezone.now()
        return super().update(instance, validated_data)


# Dashboard

StatusCountsSerializer = type(
    "StatusCountsSerializer",
    (serializers.Serializer,),
    {status.value: serializers.IntegerField() for status in Status},
)


class UpcomingInterviewSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="application.job_title")
    company_name = serializers.CharField(source="application.company.name")
    application_id = serializers.IntegerField()

    class Meta:
        model = Interview
        fields = ["id", "job_title", "company_name", "scheduled_at", "type", "application_id"]


class DashboardSerializer(serializers.Serializer):
    counts = StatusCountsSerializer()
    upcoming_interviews = UpcomingInterviewSerializer(many=True)


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
