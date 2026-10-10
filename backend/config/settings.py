import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Every setting that differs between environments comes from the environment.
# SECRET_KEY has no default, so a missing key stops startup instead of signing
# tokens with a value from Git.
SECRET_KEY = os.environ["SECRET_KEY"]
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "").split(",") if h.strip()]

# No admin, sessions, or messages: the API authenticates with JWT only.
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "tracker",
]

# No session, auth, or CSRF middleware, so a request that does not query the
# database (GET /api/health/live/) never opens a connection.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Swagger UI renders a template from drf_spectacular.
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", ""),
        "USER": os.environ.get("POSTGRES_USER", ""),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", ""),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "tracker.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "tracker.views.api_exception_handler",
    # Register and login set ScopedRateThrottle themselves. Separate scopes keep
    # one limit from blocking the other.
    "DEFAULT_THROTTLE_RATES": {
        "register": "10/min",
        "login": "10/min",
    },
    # Proxies in front of Django. Production sets 2 (CloudFront and the load
    # balancer) so the throttle keys on the client IP. Locally there is none.
    "NUM_PROXIES": int(os.environ.get("NUM_PROXIES", "0")),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Applications Tracker API",
    "DESCRIPTION": "Track job applications, interviews, and notes.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Separate request and response components, so writes show company_name
    # and reads show company.
    "COMPONENT_SPLIT_REQUEST": True,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
    "SERVE_AUTHENTICATION": [],
}
