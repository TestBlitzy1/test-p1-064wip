# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming
locals {
  name_prefix = "${var.environment}-redis"
}

# Redis Replication Group
resource "aws_elasticache_replication_group" "redis_cluster" {
  replication_group_id          = "${local.name_prefix}-cluster"
  description                   = "Redis cluster for Sales Intelligence Platform"
  node_type                    = var.node_type
  num_cache_clusters           = var.num_cache_nodes
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis_params.name
  subnet_group_name            = aws_elasticache_subnet_group.redis_subnet.name
  security_group_ids           = [aws_security_group.redis_sg.id]
  automatic_failover_enabled   = var.automatic_failover_enabled
  multi_az_enabled            = true
  engine                      = "redis"
  engine_version              = "7.0"
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  snapshot_retention_limit    = 7
  snapshot_window             = "03:00-04:00"
  maintenance_window          = "mon:04:00-mon:05:00"

  tags = {
    Environment = var.environment
    Service     = "redis-cache"
    ManagedBy   = "terraform"
  }
}

# Redis Subnet Group
resource "aws_elasticache_subnet_group" "redis_subnet" {
  name        = "${local.name_prefix}-subnet"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for Redis cluster"

  tags = {
    Environment = var.environment
    Service     = "redis-cache"
    ManagedBy   = "terraform"
  }
}

# Redis Parameter Group
resource "aws_elasticache_parameter_group" "redis_params" {
  family      = "redis7"
  name        = "${local.name_prefix}-params"
  description = "Redis parameter group for cluster configuration"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Environment = var.environment
    Service     = "redis-cache"
    ManagedBy   = "terraform"
  }
}

# Security Group for Redis
resource "aws_security_group" "redis_sg" {
  name        = "${local.name_prefix}-sg"
  vpc_id      = var.vpc_id
  description = "Security group for Redis cluster"

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Redis port access from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Environment = var.environment
    Service     = "redis-cache"
    ManagedBy   = "terraform"
  }
}

# Outputs for Redis cluster information
output "primary_endpoint_address" {
  value       = aws_elasticache_replication_group.redis_cluster.primary_endpoint_address
  description = "Primary endpoint address of the Redis cluster"
}

output "reader_endpoint_address" {
  value       = aws_elasticache_replication_group.redis_cluster.reader_endpoint_address
  description = "Reader endpoint address of the Redis cluster"
}

output "redis_port" {
  value       = aws_elasticache_replication_group.redis_cluster.port
  description = "Port number of the Redis cluster"
}

output "redis_security_group_id" {
  value       = aws_security_group.redis_sg.id
  description = "ID of the Redis security group"
}