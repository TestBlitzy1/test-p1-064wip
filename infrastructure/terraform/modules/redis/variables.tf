# Core environment variable
variable "environment" {
  type        = string
  description = "Environment name for resource naming and tagging (e.g., dev, staging, prod)"

  validation {
    condition     = can(regex("^(dev|staging|prod|dr)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod, dr."
  }
}

# Networking variables
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where Redis cluster will be deployed"

  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block of the VPC for security group ingress rules"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where Redis nodes will be deployed"

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs are required for high availability."
  }

  validation {
    condition     = can([for id in var.subnet_ids : regex("^subnet-[a-z0-9]+$", id)])
    error_message = "All subnet IDs must be valid AWS subnet identifiers."
  }
}

# Redis cluster configuration
variable "node_type" {
  type        = string
  description = "Instance type for Redis nodes (e.g., cache.r6g.large)"
  default     = "cache.r6g.large"

  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.node_type))
    error_message = "Node type must be a valid ElastiCache instance type."
  }
}

variable "num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the Redis cluster"
  default     = 2

  validation {
    condition     = var.num_cache_nodes >= 2 && var.num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 2 and 6."
  }
}

variable "automatic_failover_enabled" {
  type        = bool
  description = "Enable automatic failover for high availability"
  default     = true
}

# Additional configuration variables
variable "port" {
  type        = number
  description = "Port number for Redis connections"
  default     = 6379

  validation {
    condition     = var.port > 0 && var.port < 65536
    error_message = "Port number must be between 1 and 65535."
  }
}

variable "parameter_group_family" {
  type        = string
  description = "Redis parameter group family"
  default     = "redis6.x"

  validation {
    condition     = can(regex("^redis[0-9]+\\.x$", var.parameter_group_family))
    error_message = "Parameter group family must be a valid Redis version (e.g., redis6.x)."
  }
}

variable "maintenance_window" {
  type        = string
  description = "Preferred maintenance window"
  default     = "sun:05:00-sun:09:00"

  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.maintenance_window))
    error_message = "Maintenance window must be in the format 'ddd:hh:mm-ddd:hh:mm'."
  }
}

variable "snapshot_retention_limit" {
  type        = number
  description = "Number of days for which ElastiCache will retain automatic cache cluster snapshots"
  default     = 7

  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "tags" {
  type        = map(string)
  description = "Additional tags for Redis resources"
  default     = {}
}