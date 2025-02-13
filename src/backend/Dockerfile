# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Final runtime
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_HOME=/app \
    PORT=8000 \
    WORKERS=4 \
    CUDA_VERSION=11.8.0

# Install Python and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    python3.11-venv \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3.11 /usr/bin/python

# Create non-root user
RUN groupadd -r app && useradd -r -g app app

# Create necessary directories with proper permissions
RUN mkdir -p ${APP_HOME} \
    ${APP_HOME}/data \
    /tmp/app \
    && chown -R app:app ${APP_HOME} \
    && chown -R app:app /tmp/app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Set working directory
WORKDIR ${APP_HOME}

# Copy application code
COPY --chown=app:app . ${APP_HOME}

# Switch to non-root user
USER app

# Configure security
RUN python -m compileall ${APP_HOME}

# Expose service port
EXPOSE ${PORT}

# Set resource limits
LABEL com.nvidia.volumes.needed="nvidia_driver"
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Labels
LABEL maintainer="DevOps Team" \
      version="1.0.0" \
      description="Backend service container" \
      security.scan-date="2023-01-01"

# Set entrypoint
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]