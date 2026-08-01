FROM python:3.12-slim AS builder

WORKDIR /app/apps/api

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip uv

COPY apps/api/pyproject.toml apps/api/uv.lock ./

RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runner

WORKDIR /app/apps/api

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/apps/api/.venv/bin:$PATH"

RUN groupadd --system app && useradd --system --gid app --home /app app

COPY --from=builder --chown=app:app /app/apps/api/.venv /app/apps/api/.venv

COPY --chown=app:app apps/api /app/apps/api
COPY --chown=app:app data /app/data

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/live', timeout=3)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
