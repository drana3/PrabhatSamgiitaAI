variable "budget_name" {
  type        = string
  description = "Azure budget name."
  default     = "dewasheesh"
}

variable "subscription_id" {
  type        = string
  description = "Target Azure subscription ID."
}

variable "amount" {
  type        = number
  description = "Monthly budget amount."
  default     = 2000
}

variable "notification_email" {
  type        = string
  description = "Email address that receives budget alerts."
  default     = "dewasheesh.rana3@gmail.com"
}

variable "alert_threshold" {
  type        = number
  description = "Alert threshold percentage."
  default     = 70
}

variable "start_date" {
  type        = string
  description = "Budget start date in RFC3339 format."
  default     = ""
}

variable "end_date" {
  type        = string
  description = "Budget end date in RFC3339 format."
  default     = "2035-06-01T00:00:00Z"
}
