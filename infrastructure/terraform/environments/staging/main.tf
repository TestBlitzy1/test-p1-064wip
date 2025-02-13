# Terraform configuration for staging environment
# Provider version: ~> 5.0
# Purpose: Orchestrates infrastructure for the staging environment of the Sales Intelligence Platform

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "sales-intelligence-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Provider configuration
provider "aws" {
  region = local.region
  default_tags {
    tags = local.common_tags
  }
}

# Local variables
locals {
  environment = "staging"
  region     = "us-east-1"
  vpc_cidr   = "10.1.0.0/16"
  
  common_tags = {
    Environment     = "staging"
    Project         = "sales-intelligence-platform"
    ComplianceScope = "SOC2"
    SecurityLevel   = "high"
  }
}

# VPC Module
module "vpc" {
  source = "../modules/vpc"

  environment              = local.environment
  region                  = local.region
  cidr_block              = local.vpc_cidr
  azs                     = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_flow_logs        = true
  flow_logs_retention_days = 30
  enable_nat_gateway      = true
  single_nat_gateway      = false
  tags                    = local.common_tags
}

# EKS Module
module "eks" {
  source = "../modules/eks"

  environment            = local.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnets
  cluster_version       = "1.27"
  enable_monitoring     = true
  enable_logging        = true
  log_retention_days    = 30
  
  node_groups = {
    general = {
      instance_types = ["t3.large"]
      min_size      = 2
      max_size      = 4
      desired_size  = 2
      disk_size     = 50
    }
  }
  
  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "../modules/rds"

  environment                = local.environment
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.database_subnets
  instance_class            = "db.r6g.xlarge"
  multi_az                  = true
  allocated_storage         = 100
  engine_version            = "15.0"
  backup_retention_period   = 7
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"
  enable_performance_insights = true
  enable_enhanced_monitoring = true
  monitoring_interval       = 60
  tags                      = local.common_tags
}

# Redis Module
module "redis" {
  source = "../modules/redis"

  environment                = local.environment
  vpc_id                    = module.vpc.vpc_id
  vpc_cidr                  = local.vpc_cidr
  subnet_ids                = module.vpc.database_subnets
  node_type                 = "cache.r6g.large"
  num_cache_nodes           = 2
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  maintenance_window        = "sun:05:00-sun:06:00"
  snapshot_retention_limit  = 7
  tags                      = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "Endpoint for the RDS instance"
  value       = module.rds.db_instance
  sensitive   = true
}

output "redis_endpoint" {
  description = "Endpoint for the Redis cluster"
  value       = module.redis.primary_endpoint_address
  sensitive   = true
}