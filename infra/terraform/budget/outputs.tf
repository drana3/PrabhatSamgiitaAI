output "budget_id" {
  value       = azurerm_consumption_budget_subscription.monthly.id
  description = "Azure budget resource ID."
}
