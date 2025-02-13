# VPC Module Outputs
# Provider version: ~> 5.0
# Purpose: Expose VPC networking components for secure multi-AZ infrastructure deployment

# Primary VPC identifier for service integration
output "vpc_id" {
  description = "The ID of the VPC for integration with AWS services and security group configurations"
  value       = aws_vpc.main.id
}

# VPC CIDR block for network planning
output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for network planning and security group rules"
  value       = aws_vpc.main.cidr_block
}

# Public subnet IDs for external-facing resources
output "public_subnet_ids" {
  description = "List of IDs of public subnets for ALB and NAT gateway placement across availability zones"
  value       = aws_subnet.public[*].id
}

# Private subnet IDs for application workloads
output "private_subnet_ids" {
  description = "List of IDs of private subnets for EKS node groups and application workloads"
  value       = aws_subnet.private[*].id
}

# Database subnet IDs for data tier
output "database_subnet_ids" {
  description = "List of IDs of database subnets for RDS and ElastiCache deployment in isolated network tier"
  value       = aws_subnet.database[*].id
}

# Public subnet CIDR blocks
output "public_subnet_cidrs" {
  description = "List of CIDR blocks of public subnets for network planning and security group rules"
  value       = aws_subnet.public[*].cidr_block
}

# Private subnet CIDR blocks
output "private_subnet_cidrs" {
  description = "List of CIDR blocks of private subnets for network planning and security group rules"
  value       = aws_subnet.private[*].cidr_block
}

# Database subnet CIDR blocks
output "database_subnet_cidrs" {
  description = "List of CIDR blocks of database subnets for network planning and security group rules"
  value       = aws_subnet.database[*].cidr_block
}

# NAT Gateway IPs for egress traffic
output "nat_gateway_ips" {
  description = "List of Elastic IPs associated with NAT Gateways for outbound internet access"
  value       = aws_eip.nat[*].public_ip
}

# Route table IDs for network customization
output "public_route_table_id" {
  description = "ID of the public route table for custom route management"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of IDs of private route tables for custom route management"
  value       = aws_route_table.private[*].id
}

# VPC Flow Log configuration
output "vpc_flow_log_group" {
  description = "Name of the CloudWatch Log Group for VPC Flow Logs"
  value       = "/aws/vpc/${var.environment}-flow-logs"
}

output "vpc_flow_log_role_arn" {
  description = "ARN of the IAM role used for VPC Flow Logs"
  value       = aws_iam_role.flow_logs.arn
}