# AWS provider version constraint is handled in the root module

variable "environment" {
  type        = string
  description = "Environment name (dev/staging/prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version for EKS cluster"
  default     = "1.27"
  validation {
    condition     = can(regex("^1\\.(2[7-9]|[3-9][0-9])$", var.cluster_version))
    error_message = "Cluster version must be 1.27 or higher."
  }
}

variable "cluster_log_types" {
  type        = list(string)
  description = "List of EKS cluster log types to enable"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for EKS cluster and node groups"
}

variable "endpoint_private_access" {
  type        = bool
  description = "Enable private API server endpoint access"
  default     = true
}

variable "endpoint_public_access" {
  type        = bool
  description = "Enable public API server endpoint access"
  default     = false
}

variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    min_size      = number
    max_size      = number
  }))
  description = "Map of EKS node group configurations"
  default = {
    app = {
      instance_types = ["t3.xlarge"]
      desired_size   = 3
      min_size      = 3
      max_size      = 12
    }
    ai = {
      instance_types = ["g4dn.xlarge"]
      desired_size   = 2
      min_size      = 2
      max_size      = 4
    }
  }

  validation {
    condition = alltrue([
      for k, v in var.node_groups : 
        v.min_size <= v.desired_size && 
        v.desired_size <= v.max_size && 
        v.min_size > 0
    ])
    error_message = "Node group sizes must satisfy: 0 < min_size <= desired_size <= max_size"
  }

  validation {
    condition = alltrue([
      for k, v in var.node_groups :
        length(v.instance_types) > 0
    ])
    error_message = "Each node group must specify at least one instance type"
  }
}

variable "tags" {
  type        = map(string)
  description = "Additional tags for EKS resources"
  default     = {}
}