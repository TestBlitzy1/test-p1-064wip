# AWS VPC Module Configuration
# Provider version: ~> 5.0
# Purpose: Creates a highly available VPC infrastructure with public, private, and database subnets
# Compliance: SOC2 and ISO27001 compliant networking configuration

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  # Calculate subnet CIDR blocks using cidrsubnets function
  public_subnet_cidrs   = cidrsubnets(var.cidr_block, 4, 4, 4)
  private_subnet_cidrs  = cidrsubnets(var.cidr_block, 4, 4, 4)
  database_subnet_cidrs = cidrsubnets(var.cidr_block, 4, 4, 4)

  # Common tags for all resources
  common_tags = {
    Environment     = var.environment
    Terraform      = "true"
    ComplianceScope = "SOC2-ISO27001"
  }
}

# Main VPC Resource
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = var.enable_dns_support

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-vpc"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-igw"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = element(local.public_subnet_cidrs, count.index)
  availability_zone       = element(var.availability_zones, count.index)
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name                        = "${var.environment}-public-${element(var.availability_zones, count.index)}"
      Tier                       = "public"
      "kubernetes.io/role/elb"   = "1"
      "kubernetes.io/cluster/${var.environment}" = "shared"
    }
  )
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = element(local.private_subnet_cidrs, count.index)
  availability_zone = element(var.availability_zones, count.index)

  tags = merge(
    local.common_tags,
    {
      Name                              = "${var.environment}-private-${element(var.availability_zones, count.index)}"
      Tier                             = "private"
      "kubernetes.io/role/internal-elb" = "1"
      "kubernetes.io/cluster/${var.environment}" = "shared"
    }
  )
}

# Database Subnets
resource "aws_subnet" "database" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = element(local.database_subnet_cidrs, count.index)
  availability_zone = element(var.availability_zones, count.index)

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-database-${element(var.availability_zones, count.index)}"
      Tier = "database"
    }
  )
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0
  domain = "vpc"

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-eip-${count.index + 1}"
    }
  )
}

# NAT Gateways
resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0
  allocation_id = element(aws_eip.nat.*.id, count.index)
  subnet_id     = element(aws_subnet.public.*.id, count.index)

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-nat-${count.index + 1}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-public-rt"
      Tier = "public"
    }
  )
}

resource "aws_route_table" "private" {
  count  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 1
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = element(aws_nat_gateway.main.*.id, var.single_nat_gateway ? 0 : count.index)
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-private-rt-${count.index + 1}"
      Tier = "private"
    }
  )
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = element(aws_subnet.public.*.id, count.index)
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = element(aws_subnet.private.*.id, count.index)
  route_table_id = element(aws_route_table.private.*.id, var.single_nat_gateway ? 0 : count.index)
}

# VPC Flow Logs
resource "aws_flow_log" "main" {
  vpc_id                = aws_vpc.main.id
  traffic_type         = "ALL"
  log_destination_type = "cloud-watch-logs"
  log_group_name       = "/aws/vpc/${var.environment}-flow-logs"
  iam_role_arn         = aws_iam_role.flow_logs.arn

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-flow-logs"
    }
  )
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "flow_logs" {
  name = "${var.environment}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM Policy for VPC Flow Logs
resource "aws_iam_role_policy" "flow_logs" {
  name = "${var.environment}-vpc-flow-logs-policy"
  role = aws_iam_role.flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}