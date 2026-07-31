locals {
  start_date = var.start_date != "" ? var.start_date : formatdate("YYYY-MM-01T00:00:00Z", timestamp())
}

resource "azurerm_consumption_budget_subscription" "monthly" {
  name            = var.budget_name
  subscription_id = var.subscription_id
  amount          = var.amount
  time_grain      = "Monthly"

  time_period {
    start_date = local.start_date
    end_date   = var.end_date
  }

  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = var.alert_threshold
    threshold_type = "Actual"
    contact_emails = [var.notification_email]
  }
}
