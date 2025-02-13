# Variable definitions for RDS PostgreSQL module
# Terraform version requirement: >= 1.0

variable "environment" {
  type        = string
  description = "Environment name for resource tagging and naming (e.g., dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "instance_class" {
  type        = string
  description = "RDS instance type for the database instance"
  default     = "db.r6g.xlarge"
  
  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.instance_class))
    error_message = "Instance class must be a valid RDS instance type (e.g., db.r6g.xlarge)."
  }
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage size in gigabytes"
  default     = 100
  
  validation {
    condition     = var.allocated_storage >= 20 && var.allocated_storage <= 65536
    error_message = "Allocated storage must be between 20 GB and 65536 GB."
  }
}

variable "engine_version" {
  type        = string
  description = "PostgreSQL engine version"
  default     = "15.3"
  
  validation {
    condition     = can(regex("^\\d+\\.\\d+(\\.\\d+)?$", var.engine_version))
    error_message = "Engine version must be a valid PostgreSQL version (e.g., 15.3)."
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where RDS will be deployed"
  
  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid vpc identifier (e.g., vpc-12345678)."
  }
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for RDS subnet group (minimum 2 for Multi-AZ)"
  
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnet IDs are required for Multi-AZ deployment."
  }

  validation {
    condition     = alltrue([for s in var.subnet_ids : can(regex("^subnet-[a-z0-9]+$", s))])
    error_message = "All subnet IDs must be valid subnet identifiers (e.g., subnet-12345678)."
  }
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for high availability"
  default     = true
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7
  
  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

variable "deletion_protection" {
  type        = bool
  description = "Enable deletion protection for the database instance"
  default     = true
}

variable "monitoring_interval" {
  type        = number
  description = "Enhanced monitoring interval in seconds"
  default     = 60
  
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60 seconds."
  }
}

variable "parameter_group_family" {
  type        = string
  description = "Database parameter group family"
  default     = "postgres15"
  
  validation {
    condition     = can(regex("^postgres\\d+$", var.parameter_group_family))
    error_message = "Parameter group family must be a valid PostgreSQL family (e.g., postgres15)."
  }
}

variable "tags" {
  type        = map(string)
  description = "Additional tags for RDS resources"
  default     = {}
}

variable "performance_insights_enabled" {
  type        = bool
  description = "Enable Performance Insights for monitoring database performance"
  default     = true
}

variable "performance_insights_retention_period" {
  type        = number
  description = "Performance Insights retention period in days"
  default     = 7
  
  validation {
    condition     = contains([7, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be either 7 or 731 days."
  }
}

variable "storage_encrypted" {
  type        = bool
  description = "Enable storage encryption for the database instance"
  default     = true
}

variable "apply_immediately" {
  type        = bool
  description = "Apply changes immediately or during maintenance window"
  default     = false
}