# Development Environment Configuration for Sales Intelligence Platform
# Terraform version: >= 1.0
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
    bucket         = "sales-intelligence-platform-tfstate-dev"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock-dev"
  }
}

locals {
  environment = "dev"
  region      = "us-east-1"
  vpc_cidr    = "10.0.0.0/16"
  azs         = ["us-east-1a", "us-east-1b", "us-east-1c"]

  tags = {
    Environment = local.environment
    Project     = "sales-intelligence-platform"
    ManagedBy   = "terraform"
  }
}

provider "aws" {
  region = local.region
  default_tags {
    tags = local.tags
  }
}

# VPC Module Configuration
module "vpc" {
  source = "../modules/vpc"

  environment          = local.environment
  cidr_block          = local.vpc_cidr
  availability_zones  = local.azs
  enable_nat_gateway  = true
  single_nat_gateway  = true # Cost optimization for dev environment
  enable_dns_hostnames = true
  enable_dns_support   = true
  enable_vpn_gateway   = false

  tags = {
    "kubernetes.io/cluster/${local.environment}-eks" = "shared"
  }
}

# EKS Module Configuration
module "eks" {
  source = "../modules/eks"

  environment                    = local.environment
  cluster_version               = "1.27"
  vpc_id                        = module.vpc.vpc_id
  subnet_ids                    = module.vpc.private_subnets
  
  node_groups = {
    general = {
      instance_types = ["t3.medium"]  # Cost-effective instance for dev
      desired_size   = 2
      min_size      = 1
      max_size      = 4
      disk_size     = 50
    }
  }

  enable_irsa                    = true
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true # Enable for easier access in dev

  tags = {
    Environment = local.environment
  }
}

# RDS Module Configuration
module "rds" {
  source = "../modules/rds"

  environment              = local.environment
  instance_class          = "db.t3.medium"  # Cost-effective instance for dev
  allocated_storage       = 20
  engine                  = "postgres"
  engine_version         = "15.4"
  database_name          = "sales_intelligence"
  vpc_id                 = module.vpc.vpc_id
  subnet_ids             = module.vpc.database_subnets
  
  # Dev-specific configurations
  multi_az               = false  # Single AZ for dev environment
  backup_retention_period = 7
  deletion_protection    = false  # Allow deletion in dev
  skip_final_snapshot    = true   # Skip final snapshot in dev
  
  # Monitoring configuration
  performance_insights_enabled = true
  monitoring_interval        = 60

  tags = {
    Environment = local.environment
  }
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}