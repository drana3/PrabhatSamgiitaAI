# Azure Deployment

This folder contains the Azure bootstrap and app-deploy flows for the MVP.

## Requirements

- Azure CLI
- Docker
- Docker Hub account + access token
- A valid Azure subscription

## First-time bootstrap

```bash
export PG_PASSWORD='use-a-strong-password'
export DOCKERHUB_USERNAME='your-dockerhub-username'
export DOCKERHUB_TOKEN='your-dockerhub-access-token'
./infra/azure/deploy.sh
```

The bootstrap script will:

- build and push the API and web images to Docker Hub
- create a Log Analytics workspace and Container Apps environment
- provision PostgreSQL Flexible Server
- enable the `vector` extension allowlist
- create the API and web Container Apps with scale-to-zero HTTP ingress (pulling from Docker Hub)

## Repeat deploys

For every subsequent code push, the GitHub Actions workflow uses:

```bash
./infra/azure/deploy-app.sh
```

That script rebuilds and updates the **API** Container App (`prabhatai-api`) by default. The public website is deployed to **Azure Static Web Apps** (`prabhatai-www`, East Asia) instead of `prabhatai-web` Container Apps.

### Website (Static Web Apps)

One-time setup:

```bash
./infra/azure/setup-static-web-app.sh
# Add the printed token to GitHub → Settings → Secrets → AZURE_STATIC_WEB_APPS_API_TOKEN
./infra/azure/sync-swa-app-settings.sh
# Also patches API_CORS_ORIGINS on prabhatai-api (SWA default hostname + www).
```

After `www.prabhatasamgiita.org` DNS points at Static Web Apps and smoke tests pass:

```bash
PUBLIC_SITE_URL=https://www.prabhatasamgiita.org ./infra/azure/sync-swa-app-settings.sh
CONFIRM=1 ./infra/azure/decommission-web-container-app.sh
```

Custom domain (after validating the default `*.azurestaticapps.net` URL):

```bash
az staticwebapp hostname set --hostname www.prabhatasamgiita.org -n prabhatai-www -g prabhatai-rg
```

Add the Entra redirect URI `https://<your-host>/.auth/login/aad/callback` for Microsoft sign-in.

To deploy the legacy web Container App image again (not recommended):

```bash
DEPLOY_WEB=1 ./infra/azure/deploy-app.sh
```

That script assumes the Azure foundation already exists and only rebuilds images with Docker, pushes to Docker Hub, and updates the Container Apps to the new image tag.

Set these GitHub Actions secrets for production deploys:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

If you want real-time LLM answers instead of the built-in mock fallback, provide these Azure OpenAI values as secrets and container app environment variables:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_CHAT_DEPLOYMENT`
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

## Budget

The monthly Azure budget is managed separately in `infra/terraform/budget`.

## Cost guardrails

- Container Apps use the Consumption plan, which can scale to zero and incur no resource consumption charges when idle.
- PostgreSQL uses the B1ms burstable tier by default.
- Images are hosted on Docker Hub instead of Azure Container Registry.
- The Terraform budget stack creates or updates a monthly subscription budget at the amount you specify and defaults to `2000` INR.

Important: Azure Budgets are alerting and tracking controls. They do not automatically stop billing by themselves.
