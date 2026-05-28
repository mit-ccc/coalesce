# Base application build
FROM python:3.12-slim AS app-dev
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copy all server code
COPY . .

CMD ["python", "server.py"]

# Production build
FROM app-dev AS app-prod
ENV FLASK_ENV=production
ENV FLASK_APP=server.py
ENV FLASK_API_ONLY=true

# Install Gunicorn
RUN pip install --no-cache-dir gunicorn

# Create a non-root user to run the application
RUN useradd -m appuser
RUN chown -R appuser:appuser /app
USER appuser

# Run with Gunicorn (assuming your Flask app is named 'app' in server.py)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--threads", "2", "--worker-class", "gthread", "--timeout", "120", "server:app"]