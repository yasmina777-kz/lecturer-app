FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    KRSL_HOST=0.0.0.0 \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 libgl1 libgles2 libegl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/krsl
RUN useradd --system --uid 10001 --create-home krsl
COPY requirements.txt setup.py model.py runtime.py server.py ./
RUN pip install --no-cache-dir 'torch==2.15.0+cpu' --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt \
    && python -c "import torch, cv2, mediapipe; assert torch.version.cuda is None"

RUN python setup.py \
    && rm -rf data/*.parts \
    && chown -R krsl:krsl /app/krsl
USER 10001
RUN python -c "from runtime import Engine; engine = Engine(); engine.close()"

EXPOSE 8080
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080} --limit-concurrency 8"]
