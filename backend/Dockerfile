# syntax=docker/dockerfile:1

# API image. Local Compose and ECS run this same image. Migrations are not
# part of CMD: production runs them as a one-off task before the service
# updates, and compose.yaml runs them before gunicorn locally.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid app --no-create-home app

RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install -r requirements.txt

COPY --chown=1001:1001 . .

USER app

EXPOSE 8000

# One worker: the login and register throttles count in process memory, so
# each extra worker would multiply the 10 per minute limit.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "1"]
