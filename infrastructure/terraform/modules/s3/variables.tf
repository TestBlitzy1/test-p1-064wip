# Variable definitions for the S3 module configuring bucket properties, security settings,
# and lifecycle policies for the Sales Intelligence Platform

variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket for storing application assets and data. Must comply with AWS S3 naming conventions."
  
  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.bucket_name))
    error_message = "Bucket name must contain only lowercase letters, numbers, dots, and hyphens"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment for the S3 bucket. Controls environment-specific configurations and policies."
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "allowed_origins" {
  type        = list(string)
  description = "List of origins allowed to make CORS requests to the bucket. Must be properly formatted domain names or IP addresses."
  default     = []
}

variable "allowed_principal_arns" {
  type        = list(string)
  description = "List of AWS principal ARNs allowed to access the bucket. Used for generating IAM bucket policies."
  default     = []
}

variable "versioning_enabled" {
  type        = bool
  description = "Enable versioning for the S3 bucket to maintain multiple variants of objects."
  default     = true
}

variable "encryption_enabled" {
  type        = bool
  description = "Enable server-side encryption for the S3 bucket using AES-256 encryption."
  default     = true
}

variable "lifecycle_rules" {
  type = list(object({
    id                       = string
    enabled                 = bool
    prefix                  = string
    transition_days         = number
    transition_storage_class = string
    expiration_days         = number
  }))
  description = "List of lifecycle rules for transitioning objects between storage classes and expiration."
  default = [
    {
      id                       = "transition-to-glacier"
      enabled                 = true
      prefix                  = ""
      transition_days         = 365
      transition_storage_class = "GLACIER"
      expiration_days         = 0
    }
  ]
}

variable "logging_enabled" {
  type        = bool
  description = "Enable server access logging for the S3 bucket."
  default     = true
}

variable "logging_target_bucket" {
  type        = string
  description = "Name of the target bucket for storing S3 access logs. Required if logging is enabled."
  default     = ""
}

variable "logging_target_prefix" {
  type        = string
  description = "Prefix for organizing log files in the logging target bucket."
  default     = "s3-access-logs/"
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to the S3 bucket and related resources."
  default     = {}
}