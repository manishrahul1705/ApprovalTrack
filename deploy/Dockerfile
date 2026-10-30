FROM node:22-bookworm-slim AS node-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM python:3.12-slim-bookworm
ENV NODE_ENV=production PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PYTHON_BIN=python UPLOAD_DIR=/var/data/uploads \
    CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310 \
    AI_SERVICE_URL="" QUEUE_MODE=inline LOCAL_AI_SERIAL=true \
    OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    clamav-daemon clamav-freshclam clamdscan tini gosu \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin \
    libreoffice-writer fonts-dejavu-core fonts-noto-core libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node-deps /usr/local/bin/node /usr/local/bin/node
COPY deploy/requirements.txt /app/deploy/requirements.txt
RUN pip install --no-cache-dir -r /app/deploy/requirements.txt && pip check
COPY --from=node-deps /app/backend/node_modules /app/backend/node_modules
COPY backend/package.json /app/backend/package.json
COPY backend/src /app/backend/src
COPY backend/templates /app/backend/templates
COPY backend/scripts /app/backend/scripts
COPY mlmodels /app/mlmodels
COPY deploy /app/deploy
RUN useradd --uid 1000 --create-home appuser \
    && chmod 755 /app/deploy/start.sh \
    && mkdir -p /tmp/approvaltrack-preflight \
    && chown appuser:appuser /tmp/approvaltrack-preflight \
    && UPLOAD_DIR=/tmp/approvaltrack-preflight gosu appuser python /app/deploy/preflight.py
WORKDIR /app/backend
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--", "/app/deploy/start.sh"]
