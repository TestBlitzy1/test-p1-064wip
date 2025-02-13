# Production Environment Terraform Configuration
# Provider versions:
# - hashicorp/aws ~> 5.0
# - hashicorp/kubernetes ~> 2.23

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  backend "s3" {
    bucket         = "sales-intelligence-tfstate-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/terraform-state"
  }
}

# Configure AWS Provider
provider "aws" {
  region = local.aws_region

  default_tags {
    tags = local.compliance_tags
  }
}

# Local variables
locals {
  environment = "prod"
  aws_region = "us-east-1"
  vpc_cidr   = "10.0.0.0/16"
  
  compliance_tags = {
    Environment        = "prod"
    SOC2              = "true"
    ISO27001          = "true"
    DataClassification = "confidential"
    ManagedBy         = "terraform"
    Project           = "sales-intelligence-platform"
  }
}

# VPC Module
module "vpc" {
  source = "../modules/vpc"

  environment         = local.environment
  cidr_block         = local.vpc_cidr
  azs                = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_nat_gateway = true
  single_nat_gateway = false
  enable_vpn_gateway = false
  enable_flow_logs   = true
  flow_logs_retention = 365
  
  tags = local.compliance_tags
}

# EKS Module
module "eks" {
  source = "../modules/eks"

  environment              = local.environment
  cluster_version         = "1.27"
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnets
  enable_encryption       = true
  
  node_groups = {
    general = {
      instance_types = ["r6g.xlarge"]
      min_size      = 3
      max_size      = 12
      desired_size  = 3
      disk_size     = 100
      disk_encryption = true
    }
    ai = {
      instance_types = ["g4dn.xlarge"]
      min_size      = 1
      max_size      = 4
      desired_size  = 2
      disk_size     = 200
      disk_encryption = true
    }
  }

  tags = local.compliance_tags
}

# RDS Module
module "rds" {
  source = "../modules/rds"

  environment               = local.environment
  instance_class           = "db.r6g.xlarge"
  allocated_storage        = 100
  engine_version           = "15"
  multi_az                 = true
  subnet_ids               = module.vpc.database_subnets
  vpc_id                   = module.vpc.vpc_id
  backup_retention_period  = 30
  deletion_protection      = true
  performance_insights_enabled = true
  storage_encrypted        = true
  monitoring_interval      = 10
  
  tags = local.compliance_tags
}

# Redis Module
module "redis" {
  source = "../modules/redis"

  environment                = local.environment
  node_type                 = "cache.r6g.large"
  num_cache_nodes           = 2
  automatic_failover_enabled = true
  multi_az_enabled          = true
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.database_subnets
  vpc_cidr                  = local.vpc_cidr
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled        = true
  
  tags = local.compliance_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.redis_endpoint
  sensitive   = true
}