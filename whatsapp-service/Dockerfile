FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py arquivador.py ./
RUN mkdir -p /app/sessoes && chown -R app:app /app
USER app
ENV TZ=America/Sao_Paulo
CMD ["python", "-u", "app.py"]
