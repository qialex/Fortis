terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "primary_region" {
  default = "us-east-1"
}

variable "regions" {
  type    = list(string)
  default = ["us-east-1", "eu-west-2", "ap-southeast-2"]
}

variable "jwt_secret" {
  sensitive = true
}

variable "base_url" {}
variable "from_email" {}

# Primary region provider
provider "aws" {
  region = var.primary_region
  alias  = "primary"
}

provider "aws" {
  region = "eu-west-2"
  alias  = "eu"
}

provider "aws" {
  region = "ap-southeast-2"
  alias  = "au"
}

# ── DynamoDB ─────────────────────────────────────────────

# Users table as a Global Table — replicated in all 3 regions
# Reads hit local replica (~5ms). Writes always go to primary
# via usersWriteRegion in the adapter to prevent duplicate email race conditions.
resource "aws_dynamodb_table" "users" {
  provider         = aws.primary
  name             = "fortis-users"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"  # required for Global Tables

  attribute { name = "PK"; type = "S" }
  attribute { name = "SK"; type = "S" }
  attribute { name = "userId"; type = "S" }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  replica {
    region_name = "eu-west-2"
  }

  replica {
    region_name = "ap-southeast-2"
  }

  tags = { Project = "fortis" }
}

# Regional token tables — one per region
resource "aws_dynamodb_table" "tokens_us" {
  provider     = aws.primary
  name         = "fortis-tokens-us"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute { name = "PK"; type = "S" }
  attribute { name = "SK"; type = "S" }
  attribute { name = "userId"; type = "S" }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  ttl { attribute_name = "expiresAt"; enabled = true }
  tags = { Project = "fortis", Region = "us" }
}

resource "aws_dynamodb_table" "tokens_eu" {
  provider     = aws.eu
  name         = "fortis-tokens-eu"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute { name = "PK"; type = "S" }
  attribute { name = "SK"; type = "S" }
  attribute { name = "userId"; type = "S" }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  ttl { attribute_name = "expiresAt"; enabled = true }
  tags = { Project = "fortis", Region = "eu" }
}

resource "aws_dynamodb_table" "tokens_au" {
  provider     = aws.au
  name         = "fortis-tokens-au"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute { name = "PK"; type = "S" }
  attribute { name = "SK"; type = "S" }
  attribute { name = "userId"; type = "S" }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  ttl { attribute_name = "expiresAt"; enabled = true }
  tags = { Project = "fortis", Region = "au" }
}

# ── Secrets Manager ──────────────────────────────────────

resource "aws_secretsmanager_secret" "jwt_secret" {
  provider = aws.primary
  name     = "fortis/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  provider      = aws.primary
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

# ── Lambda IAM ───────────────────────────────────────────

resource "aws_iam_role" "lambda_exec" {
  name = "fortis-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "fortis-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
          "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.jwt_secret.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

# ── Route 53 latency routing ─────────────────────────────

resource "aws_route53_zone" "auth" {
  name = "auth.${var.base_url}"
}

# Add latency records per region after deploying API Gateways
# See docs/self-hosting.md for full setup
