# Azure Budget Terraform

This stack manages the Azure monthly budget separately from app deploys.

## Apply

```bash
terraform -chdir=infra/terraform/budget init
terraform -chdir=infra/terraform/budget apply \
  -var="subscription_id=<azure-subscription-id>" \
  -var="budget_name=dewasheesh" \
  -var="amount=2000" \
  -var="notification_email=dewasheesh.rana3@gmail.com"
```

## What it manages

- a monthly Azure subscription budget
- a 70 percent alert email

The budget is alerting-only, so the low-cost Container Apps + burstable PostgreSQL setup still does the heavy lifting for cost control.
