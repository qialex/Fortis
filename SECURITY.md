# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: security@fortisauth.dev

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (optional)

You will receive a response within 48 hours. We aim to patch critical issues within 7 days.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.x     | Yes       |

## Security model

Fortis is self-hosted. You are responsible for:
- Keeping your `JWT_SECRET` secret and rotating it periodically
- Restricting DynamoDB table access via IAM to only your Lambda functions
- Keeping Lambda runtimes up to date
- Configuring WAF on your API Gateway endpoints
- SES bounce/complaint handling to protect your sender reputation

Fortis provides:
- Bcrypt password hashing (cost factor 12)
- Short-lived JWTs (15 min default)
- Refresh token rotation on every use
- Rate limiting on all auth endpoints
- Timing-safe comparisons for token verification
- No secrets logged
