# Coalesce

A mixed-initiative system that uses LLMs to help civic leaders write questions for surveys, interviews, and conversation guides.

## Background

Effectively incorporating community input into civic decision-making is crucial for inclusive governance, yet public officials often have trouble writing effective questions due to time, resource, and experience constraints. Coalesce helps by improving question readability, specificity, and reducing bias, following best practices in questionnaire design.

Coalesce was originally built by Cassandra Overney, a Ph.D. candidate at MIT's [Center for Constructive Communication (CCC)](https://www.media.mit.edu/groups/center-for-constructive-communication/overview/). Her paper [Coalesce: An Accessible Mixed-Initiative System for Designing Community-Centric Questionnaires](https://dl.acm.org/doi/10.1145/3708359.3712118) documents the initial user study. The CCC Translational Research team then adopted and iterated on the prototype through additional user studies and UI improvements.

This code was open sourced in May 2026 as part of a code-share agreement between CCC and [Cortico](https://cortico.ai/), a nonprofit amplifying underheard voices. The concept will become part of Cortico's product offering. **This repository will not be updated further.**

## Architecture

| Layer      | Technology                               |
| ---------- | ---------------------------------------- |
| Frontend   | React 18 (Create React App), Material UI |
| Backend    | Python / Flask                           |
| Task queue | Celery + Redis                           |
| Database   | MongoDB Atlas                            |
| AI         | OpenAI GPT-4o via DSPy                   |

## Running Locally

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)
- An [OpenAI API key](https://platform.openai.com/api-keys)
- [Node.js](https://nodejs.org/) (v18+) and npm (for the frontend)

### 1. Configure secrets

The backend reads credentials from `server/.env`. Copy the example file and fill in your values:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env`:

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
FLASK_SECRET_KEY=<any-long-random-string>
OPENAI_API_KEY=sk-...
REDIS_BROKER_URL=redis://redis:6379/0   # matches the Docker service name; use redis://localhost:6379/0 without Docker
```

> `server/.env` is in `.gitignore`. Do not commit it.

### 2. Start the backend (Docker)

From the repo root:

```bash
docker compose up --build
```

This starts three services:

| Service       | URL                   |
| ------------- | --------------------- |
| Flask API     | http://localhost:5001 |
| Celery worker | (background)          |
| Redis         | localhost:6379        |

### 3. Start the frontend

In a separate terminal:

```bash
cd ui
npm install   # first time only
npm start
```

The React app runs at http://localhost:3000 and proxies API requests to the Flask backend on port 5001.

### Running the backend without Docker

```bash
cd server

# Create and activate a conda environment
conda create -n coalesce python=3.12
conda activate coalesce

# Install dependencies
pip install -r requirements.txt

# Start Redis separately (e.g. via Homebrew: brew services start redis)

# Run the server
python server.py
```

Then start the Celery worker in a second terminal:

```bash
cd server
conda activate coalesce
celery -A server.celery worker --loglevel=INFO
```

> When running outside Docker, set `REDIS_BROKER_URL=redis://localhost:6379/0` in `server/.env`.

## Repository Structure

```
coalesce/
├── server/              # Flask backend + Celery tasks
│   ├── server.py        # main application entry point
│   ├── db.py            # MongoDB access layer
│   ├── dspy_accessor.py # LLM calls via DSPy
│   ├── dspy_modules.py  # DSPy prompt modules
│   ├── compiled_modules/# pre-optimized DSPy modules
│   └── requirements.txt
├── ui/                  # React frontend
│   └── src/
├── docker-compose.yml   # local dev and production container definitions
└── Makefile             # deployment helpers (AWS)
```

## References

```bibtex
@inproceedings{overney2025coalesce,
  title     = {Coalesce: An Accessible Mixed-Initiative System for Designing Community-Centric Questionnaires},
  author    = {Overney, Cassandra and Kessler, Daniel T. and Fulay, Suyash P. and Jasim, Mahmood and Roy, Deb},
  booktitle = {Proceedings of the 30th International Conference on Intelligent User Interfaces (IUI '25)},
  year      = {2025},
  address   = {Cagliari, Italy},
  publisher = {ACM},
  doi       = {10.1145/3708359.3712118}
}
```
