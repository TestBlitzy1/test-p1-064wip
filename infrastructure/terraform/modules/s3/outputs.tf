# Output definitions for the S3 module exposing bucket attributes and configurations
# for use by other modules in the Sales Intelligence Platform infrastructure

output "bucket_id" {
  description = "The unique identifier of the S3 bucket used for resource referencing and integration"
  value       = aws_s3_bucket.main.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket used for IAM policy configuration and cross-service access control"
  value       = aws_s3_bucket.main.arn
}

output "bucket_domain_name" {
  description = "The domain name of the S3 bucket used for endpoint configuration and access"
  value       = aws_s3_bucket.main.bucket_domain_name
}