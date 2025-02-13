# Core cluster outputs
output "cluster_id" {
  description = "The ID of the EKS cluster"
  value       = aws_eks_cluster.main.id
}

output "cluster_name" {
  description = "The name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required for cluster authentication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_version" {
  description = "The Kubernetes version running on the EKS cluster"
  value       = aws_eks_cluster.main.version
}

output "cluster_security_group_id" {
  description = "The security group ID attached to the EKS cluster"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

# Node group outputs with enhanced configuration details
output "node_groups" {
  description = "Map of node groups with enhanced configuration details for monitoring and management"
  value = {
    app = {
      node_group_name    = aws_eks_node_group.app_nodes.node_group_name
      scaling_config     = aws_eks_node_group.app_nodes.scaling_config
      status            = aws_eks_node_group.app_nodes.status
      capacity_type     = aws_eks_node_group.app_nodes.capacity_type
      instance_types    = aws_eks_node_group.app_nodes.instance_types
      labels           = aws_eks_node_group.app_nodes.labels
      taints           = []
      availability_zones = distinct([for subnet in data.aws_subnet.app_nodes : subnet.availability_zone])
    }
    ai = {
      node_group_name    = aws_eks_node_group.ai_nodes.node_group_name
      scaling_config     = aws_eks_node_group.ai_nodes.scaling_config
      status            = aws_eks_node_group.ai_nodes.status
      capacity_type     = aws_eks_node_group.ai_nodes.capacity_type
      instance_types    = aws_eks_node_group.ai_nodes.instance_types
      labels           = aws_eks_node_group.ai_nodes.labels
      taints           = aws_eks_node_group.ai_nodes.taint
      availability_zones = distinct([for subnet in data.aws_subnet.ai_nodes : subnet.availability_zone])
    }
  }
}

# OIDC provider output for IAM roles for service accounts (IRSA)
output "oidc_provider_arn" {
  description = "ARN of the OpenID Connect provider for configuring IAM roles for service accounts"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# Data sources for subnet information
data "aws_subnet" "app_nodes" {
  for_each = toset(var.subnet_ids)
  id       = each.value
}

data "aws_subnet" "ai_nodes" {
  for_each = toset(var.subnet_ids)
  id       = each.value
}