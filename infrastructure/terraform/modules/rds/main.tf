# AWS RDS PostgreSQL Module
# Terraform version: >= 1.0
# Provider versions: 
# - hashicorp/aws ~> 5.0
# - hashicorp/random ~> 3.5

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# Generate random password for RDS master user
resource "random_password" "master" {
  length  = 16
  special = true
  # Ensure password meets RDS requirements
  override_special = "!#$%^&*()-_=+[]{}<>:?"
}

# Create RDS subnet group for Multi-AZ deployment
resource "aws_db_subnet_group" "rds" {
  name_prefix = "${var.environment}-rds-"
  subnet_ids  = var.subnet_ids
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-rds-subnet-group"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Create security group for RDS access
resource "aws_security_group" "rds" {
  name_prefix = "${var.environment}-rds-"
  vpc_id      = var.vpc_id
  description = "Security group for RDS PostgreSQL instance"

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-rds-sg"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# Create IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name_prefix = "${var.environment}-rds-monitoring-"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-rds-monitoring-role"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Attach enhanced monitoring policy to IAM role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Create parameter group for PostgreSQL configuration
resource "aws_db_parameter_group" "postgresql" {
  name_prefix = "${var.environment}-postgresql-"
  family      = var.parameter_group_family

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_checkpoints"
    value = "1"
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-postgresql-params"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# Create RDS PostgreSQL instance
resource "aws_db_instance" "postgresql" {
  identifier_prefix = "${var.environment}-postgresql-"
  
  # Engine configuration
  engine                      = "postgres"
  engine_version             = var.engine_version
  instance_class             = var.instance_class
  parameter_group_name       = aws_db_parameter_group.postgresql.name

  # Storage configuration
  allocated_storage          = var.allocated_storage
  max_allocated_storage      = var.allocated_storage * 2
  storage_type              = "gp3"
  storage_encrypted         = var.storage_encrypted

  # Network configuration
  db_subnet_group_name      = aws_db_subnet_group.rds.name
  vpc_security_group_ids    = [aws_security_group.rds.id]
  multi_az                  = var.multi_az

  # Credentials
  username                  = "postgres"
  password                  = random_password.master.result
  
  # Backup configuration
  backup_retention_period   = var.backup_retention_period
  backup_window            = "03:00-04:00"
  maintenance_window       = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot    = true
  final_snapshot_identifier = "${var.environment}-postgresql-final"
  skip_final_snapshot      = false
  deletion_protection      = var.deletion_protection

  # Monitoring configuration
  monitoring_interval      = var.monitoring_interval
  monitoring_role_arn     = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Update configuration
  auto_minor_version_upgrade = true
  apply_immediately         = var.apply_immediately

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-postgresql"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )

  lifecycle {
    prevent_destroy = true
  }
}

# Create CloudWatch alarms for RDS monitoring
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.environment}-postgresql-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/RDS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors RDS CPU utilization"
  alarm_actions      = []  # Add SNS topic ARN for notifications

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgresql.id
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-postgresql-cpu-alarm"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}