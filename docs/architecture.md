# Architecture

The application uses a modular monolith pattern:

- Next.js App Router frontend
- FastAPI backend with async SQLAlchemy
- PostgreSQL with pgvector
- Optional LLM providers behind a provider-neutral interface
- Seeded canonical data and source inventory

The backend owns canonical content and inventory ingestion. The frontend only renders and streams responses from the backend API.
