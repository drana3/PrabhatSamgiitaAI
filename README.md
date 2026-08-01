# Prabhat Samgiita AI

Responsive MVP for browsing, searching, and grounding Prabhat Samgiita content with a FastAPI backend, a Next.js frontend, PostgreSQL + pgvector, and optional Azure deployment.

## What is included

- Song search by number, opening line, and semantic query
- Canonical source grounding for lyrics, meaning, media, and notation
- Streamed explanation responses
- Rule-based recommendations when no LLM is configured
- Inventory model for official and verified external resources
- Number-first audio and YouTube matching with alternate renditions preserved
- Today, occasion, festival, localization, report, and authenticated admin APIs
- In-process TTL caching, request IDs, strict media URL validation, and grounded RAG
- Azure-ready containerized deployment docs

## Catalog status

- 5,018 canonical song records
- 10,198 distinct linked audio resources covering 4,948 song numbers
- 5,252 official-source audio links covering 4,742 song numbers
- 4,946 community/link-only audio links discovered by canonical number through PS Player
- 372 number-matched YouTube embeds covering 367 songs
- 1,099 unique notation PDFs plus the official notation index
- 15,437 canonical RAG chunks generated from lyrics, meanings, themes, and source metadata

Across audio and video, 4,957 of 5,018 song numbers currently have at least one public media link.
The remaining 61 are retained as explicit coverage gaps rather than being guessed. Audio and video
remain on their source platforms and are played or embedded by URL. Third-party media is not
downloaded or re-hosted, and community audio is not labelled official.

## Local development

1. Copy `.env.example` to `.env` and adjust values.
2. Start PostgreSQL:

```bash
docker compose up -d db
```

3. Install locked dependencies:

```bash
make install
```

4. Validate and prepare the database:

```bash
make validate-data
make migrate
make seed
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

To use the real LLM in Azure, set these secrets in GitHub and the Azure Container App:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_CHAT_DEPLOYMENT`
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION` if you want to override the default

## Notes

- The app never fabricates lyrics or notation. Missing canonical fields are surfaced as pending sync.
- Search and recommendations keep working without an LLM key. Azure OpenAI adds multilingual
  localization and streamed grounded explanation when configured.
- Admin write endpoints are closed until `ADMIN_API_KEY_HASH` is configured. Generate a SHA-256
  digest outside the repository and send the original key only through the `X-Admin-Key` header.
- Official site sources:
  - [Lyrics and translations](https://prabhatasamgiita.net/1-5018.htm)
  - [Audio inventory](https://prabhatasamgiita.net/1-999/andromeda.php)
  - [Notation inventory](https://prabhatasamgiita.net/notations/andromeda.php)
  - [YouTube channel](https://www.youtube.com/@AMPS0521spirituality)

## Verification

```bash
make lint
make typecheck
make test
make test-e2e
make build
```

The deployment validates the 5,018-song database, unique media and notation inventory, RAG chunks,
embeddings, number search, meaning search, recommendations, multilingual output, streamed AI,
audio reachability, YouTube embeds, latency, and CORS before reporting success. App redeploys do not
delete PostgreSQL data.
