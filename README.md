# Prabhat Samgiita AI

Responsive MVP for browsing, searching, and grounding Prabhat Samgiita content with a FastAPI backend, a Next.js frontend, PostgreSQL + pgvector, and optional Azure deployment.

## What is included

- Song search by number, opening line, and semantic query
- Canonical source grounding for lyrics, meaning, media, and notation
- Streamed explanation responses
- Rule-based recommendations when no LLM is configured
- Inventory model for official and verified external resources
- Azure-ready containerized deployment docs

## Local development

1. Copy `.env.example` to `.env` and adjust values.
2. Start PostgreSQL:

```bash
docker compose up -d db
```

3. Install the frontend deps:

```bash
npm install
```

4. Sync backend deps:

```bash
cd apps/api && uv sync
```

5. Run the app:

```bash
npm run dev
```

Frontend: `http://localhost:3000`

API: `http://localhost:8000`

## Azure ready

The repo includes a production container setup, a one-time Azure bootstrap script, and a GitHub Actions pipeline for repeat deployments on `main`:

```bash
export PG_PASSWORD='use-a-strong-password'
./infra/azure/deploy.sh
```

That bootstrap flow uses Azure Container Apps for scale-to-zero HTTP serving and Azure Database for PostgreSQL Flexible Server with pgvector support.
It creates the Azure foundation once. After that, GitHub Actions on `main` only rebuilds and redeploys the app containers.

The recurring deployment pipeline lives in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and performs app redeploys only.

The Azure budget is managed separately through Terraform in `infra/terraform/budget` when you want to create or update the monthly budget resource.

## Notes

- The app never fabricates lyrics or notation. Missing canonical fields are surfaced as pending sync.
- Official site sources:
  - [Lyrics and translations](https://prabhatasamgiita.net/1-5018.htm)
  - [Audio inventory](https://prabhatasamgiita.net/1-999/andromeda.php)
  - [Notation inventory](https://prabhatasamgiita.net/notations/andromeda.php)
  - [YouTube channel](https://www.youtube.com/@AMPS0521spirituality)

## Next steps

- Run the scraper/importer to populate the database from the official catalog.
- Deploy API and web to Azure Container Apps and PostgreSQL Flexible Server.
- Keep PostgreSQL unless you explicitly want to reset the synced catalog. App redeploys do not delete the database.
