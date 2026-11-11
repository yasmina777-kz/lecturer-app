FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    KRSL_HOST=0.0.0.0 \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/krsl
COPY requirements.txt setup.py model.py runtime.py server.py ./
RUN pip install --no-cache-dir -r requirements.txt \
    && python setup.py

RUN useradd --system --uid 10001 --create-home krsl \
    && chown -R krsl:krsl /app/krsl
USER 10001

EXPOSE 8080
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080} --limit-concurrency 8"]
