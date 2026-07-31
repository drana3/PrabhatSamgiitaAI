# Azure Deployment

Recommended low-cost deployment:

- Azure Container Apps for the frontend and backend
- Azure Database for PostgreSQL Flexible Server with pgvector enabled
- Optional Blob Storage for cached imports and media metadata

Scale-to-zero fits the expected low-traffic MVP pattern. Keep the backend stateless except for the database and optional blob cache.

## Budget posture

The default deployment is intentionally sized far below a 2000 INR monthly ceiling:

- Azure Container Apps Consumption plan can scale to zero, and no resource consumption charges are incurred when the app is at zero replicas.
- PostgreSQL Flexible Server uses the B1ms burstable tier in the default deployment.
- Azure Container Registry uses the Basic tier in the default deployment.
- A monthly Azure budget is created or updated by the Terraform budget stack at 2000 INR unless you override the Terraform variables.

Important: Azure Budgets are monitoring and alerting controls, not automatic hard stops. If you want a true spend stop, we can add an external action-group or automation runbook next.

## Deployment checklist

1. Build production container images for the API and web app.
2. Push images to Azure Container Registry or another private registry.
3. Provision Azure Container Apps environment with HTTP ingress.
4. Provision Azure Database for PostgreSQL Flexible Server and enable the `vector` extension allowlist.
5. Set the API `DATABASE_URL` and public frontend API base URL as container app environment variables.
6. Keep minimum replicas at `0` and use HTTP scaling so the apps can scale to zero.
7. Apply the Terraform budget stack in `infra/terraform/budget` so the subscription alert stays at 2000 INR/month.

## Automated deployment

The repo now includes a GitHub Actions workflow at [`.github/workflows/deploy.yml`](/Users/chaitaniya/Documents/Prabhat Samgiita AI/.github/workflows/deploy.yml) that:

- runs lint, tests, and the web build on every push to `main`
- applies the Terraform budget stack
- rebuilds the API and web images
- updates the existing Azure Container Apps deployment

For the workflow to authenticate without storing a client secret, create a GitHub OIDC federated credential in Azure and provide these repository secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `PG_PASSWORD`

Official Azure references used while shaping this setup:

- [Container Apps environment variables](https://learn.microsoft.com/en-us/azure/container-apps/environment-variables)
- [Container Apps ingress configuration](https://learn.microsoft.com/en-us/azure/container-apps/ingress-how-to)
- [Container Apps scaling to zero](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
- [pgvector on Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector)
- [Azure consumption budgets CLI](https://learn.microsoft.com/en-us/cli/azure/consumption/budget?view=azure-cli-latest)
