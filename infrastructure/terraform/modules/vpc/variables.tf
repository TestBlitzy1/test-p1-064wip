# Terraform VPC Module Variables
# Version: ~> 1.0

variable "environment" {
  type        = string
  description = "Environment name for resource tagging (e.g., dev, staging, prod)"
}

variable "cidr_block" {
  type        = string
  description = "CIDR block for the VPC network (e.g., 10.0.0.0/16)"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for subnet distribution (e.g., us-east-1a, us-east-1b)"
}

variable "enable_dns_hostnames" {
  type        = bool
  default     = true
  description = "Enable DNS hostnames in the VPC for internal DNS resolution"
}

variable "enable_dns_support" {
  type        = bool
  default     = true
  description = "Enable DNS support in the VPC for internal DNS resolution"
}

variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "Enable NAT Gateway for private subnet internet access"
}

variable "single_nat_gateway" {
  type        = bool
  default     = false
  description = "Use a single NAT Gateway instead of one per AZ (set to true for cost savings in non-prod)"
}

variable "enable_vpn_gateway" {
  type        = bool
  default     = false
  description = "Enable VPN Gateway for VPC connectivity with on-premises networks"
}

variable "tags" {
  type = map(string)
  default = {
    "Terraform"   = "true"
    "Application" = "sales-intelligence-platform"
  }
  description = "Additional resource tags for VPC and associated resources"
}