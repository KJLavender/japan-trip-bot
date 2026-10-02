FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
# Download the models at build time so the container needs no network at runtime.
RUN python -c "import server" && chmod -R a+rX /usr/local/lib/python3.11/site-packages/rapidocr
RUN useradd --system --uid 10001 ocr
USER ocr
ENV OCR_HOST=0.0.0.0
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health')"
CMD ["python", "server.py"]
