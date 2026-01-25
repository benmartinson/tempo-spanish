FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY src/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY src/api/ ./

# Expose the port your app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "chat_stream:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]