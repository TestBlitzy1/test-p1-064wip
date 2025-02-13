# Output definitions for RDS PostgreSQL module
# Terraform version: >= 1.0
# Provider versions:
# - hashicorp/aws ~> 5.0

# Connection endpoint for the RDS PostgreSQL instance
# Used by applications to establish database connections
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS PostgreSQL instance"
  value       = aws_db_instance.postgresql.endpoint
  sensitive   = false
}

# ARN of the RDS PostgreSQL instance
# Used for IAM policies, monitoring, and cross-account access
output "db_instance_arn" {
  description = "The ARN of the RDS PostgreSQL instance"
  value       = aws_db_instance.postgresql.arn
  sensitive   = false
}

# ID of the DB subnet group
# Used for networking configuration and cross-module references
output "db_subnet_group_id" {
  description = "The ID of the DB subnet group"
  value       = aws_db_subnet_group.rds.id
  sensitive   = false
}

# ARN of the DB subnet group
# Used for resource policies and cross-account access
output "db_subnet_group_arn" {
  description = "The ARN of the DB subnet group"
  value       = aws_db_subnet_group.rds.arn
  sensitive   = false
}

# ID of the security group controlling RDS access
# Used for configuring inbound/outbound database access rules
output "security_group_id" {
  description = "The ID of the security group controlling access to RDS"
  value       = aws_security_group.rds.id
  sensitive   = false
}