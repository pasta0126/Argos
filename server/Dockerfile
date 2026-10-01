FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/data/hf

WORKDIR /app

# CPU-only torch first: on aarch64 the default PyPI wheel pulls ~3 GB of CUDA libs.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY argos_api ./argos_api

# /data/hf is the weights cache volume; create it here so the volume inherits ownership.
RUN useradd --create-home app && mkdir -p /data/hf && chown -R app /app /data
USER app

EXPOSE 8080
CMD ["uvicorn", "argos_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080"]
