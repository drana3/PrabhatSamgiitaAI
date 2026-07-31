# Azure Deployment

This folder contains the Azure bootstrap and app-deploy flows for the MVP.

## Requirements

- Azure CLI
- Docker
- A valid Azure subscription

## First-time bootstrap

```bash
export PG_PASSWORD='use-a-strong-password'
./infra/azure/deploy.sh
```

The bootstrap script will:

- create an Azure Container Registry
- build and push the API and web images
- create a Log Analytics workspace and Container Apps environment
- provision PostgreSQL Flexible Server
- enable the `vector` extension allowlist
- create the API and web Container Apps with scale-to-zero HTTP ingress

## Repeat deploys

For every subsequent code push, the GitHub Actions workflow uses:

```bash
./infra/azure/deploy-app.sh
```

That script assumes the Azure foundation already exists and only rebuilds images plus updates the Container Apps to the new image tag.

## Budget

The Azure budget is now managed by Terraform in [`infra/terraform/budget`](/Users/chaitaniya/Documents/Prabhat Samgiita AI/infra/terraform/budget).

## Cost guardrails

- Container Apps use the Consumption plan, which can scale to zero and incur no resource consumption charges when idle.
- PostgreSQL uses the B1ms burstable tier by default.
- Azure Container Registry uses the Basic tier by default.
- The Terraform budget stack creates or updates a monthly subscription budget at the amount you specify and defaults to `2000` INR.

Important: Azure Budgets are alerting and tracking controls. They do not automatically stop billing by themselves.
