FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

COPY apps/agent/pyproject.toml apps/agent/uv.lock /app/
RUN uv sync --frozen --no-cache

COPY apps/agent/ /app/

EXPOSE 8000

CMD ["uv", "run", "python", "main.py"]
