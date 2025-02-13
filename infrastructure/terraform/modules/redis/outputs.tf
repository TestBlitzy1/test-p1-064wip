# Primary endpoint output for Redis cluster
output "redis_endpoint" {
  description = "Primary endpoint address of the Redis cluster for direct connections"
  value       = aws_elasticache_replication_group.redis_cluster.primary_endpoint_address
}

# Port number output for Redis cluster
output "redis_port" {
  description = "Port number for Redis cluster connections"
  value       = aws_elasticache_replication_group.redis_cluster.port
}

# Security group ID output for Redis cluster
output "redis_security_group_id" {
  description = "Security group ID for configuring Redis cluster access rules"
  value       = aws_security_group.redis_sg.id
}

# Full connection string output for Redis cluster
output "redis_connection_string" {
  description = "Full Redis connection string in standard format for application configuration"
  value       = "redis://${aws_elasticache_replication_group.redis_cluster.primary_endpoint_address}:${aws_elasticache_replication_group.redis_cluster.port}"
  sensitive   = true
}