# Fortis

**Open source authentication infrastructure. Self-host on AWS for $120/month instead of $19,000.**

> At 1,000,000 MAU, Clerk costs ~$19,000/month. Fortis on AWS costs ~$120/month.  
> Same reliability. No vendor lock-in. You own your data.

---

## Features

- Email/password authentication
- JWT access tokens + refresh tokens
- Multi-region support (latency-based routing via Route 53)
- Regional refresh token tables (fast token ops, no cross-region reads)
- Email verification + password reset (SES, SMTP, Resend, Sendgrid)
- Rate limiting (brute force protection, no Redis required)
- Webhooks (`onUserCreated`, `onLogin`, `onPasswordReset`)
- Session management (list, revoke, revoke-all)
- Admin API (list users, ban, delete, impersonate)
- Hooks (`beforeLogin`, `afterRegister`, etc.)
- Drop-in middleware for Express and Next.js
- Database adapters: DynamoDB, Postgres, MongoDB
- Zero framework lock-in

---

## Quick start

```bash
npx @fortis/cli init
```

This creates your DynamoDB tables, configures SES, and outputs ready-to-deploy Terraform for AWS.

Or self-host locally in one command:

```bash
docker compose up
```

---

## Architecture

```
User (Sydney)  →  Route 53 (latency routing)  →  ap-southeast-2 Lambda
                                                    ├── login    → users table (us-east-1)
                                                    ├── refresh  → tokens-au (local, ~5ms)
                                                    └── register → users table (us-east-1)
```

- **Single users table** in primary region (us-east-1) — consistent registration, no duplicates
- **Regional token tables** per region — sub-10ms token refresh everywhere
- **CloudFront Functions** for JWT validation — never hits Lambda for read-only auth checks

---

## Cost at scale

| MAU | Fortis (AWS) | Clerk | Auth0 |
|-----|-------------|-------|-------|
| 10k | ~$5 | Free | Free |
| 100k | ~$20 | ~$1,800 | ~$850 |
| 500k | ~$70 | ~$9,800 | ~$3,500 |
| 1M | ~$120 | ~$19,020 | ~$7,000+ |

---

## Installation

```bash
pnpm add @fortis/core @fortis/adapter-dynamodb @fortis/adapter-ses
```

---

## Usage

### Express

```typescript
import { createFortis } from '@fortis/core'
import { dynamodbAdapter } from '@fortis/adapter-dynamodb'
import { sesAdapter } from '@fortis/adapter-ses'
import { fortisMiddleware } from '@fortis/middleware-express'

const fortis = createFortis({
  db: dynamodbAdapter({
    usersTable: 'fortis-users',
    tokensTable: 'fortis-tokens-us',
    region: 'us-east-1',
  }),
  email: sesAdapter({ region: 'us-east-1' }),
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenTTL: '15m',
    refreshTokenTTL: '30d',
  },
})

app.use(fortisMiddleware(fortis))
```

### Next.js

```typescript
// app/api/auth/[...fortis]/route.ts
import { createFortis } from '@fortis/core'
import { nextjsHandler } from '@fortis/middleware-nextjs'

export const { GET, POST } = nextjsHandler(fortis)
```

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, returns JWT + refresh token |
| POST | `/auth/logout` | Invalidate current session |
| POST | `/auth/logout-all` | Invalidate all sessions |
| POST | `/auth/token/refresh` | Refresh access token |
| POST | `/auth/email/verify` | Send verification email |
| POST | `/auth/email/confirm` | Confirm email token |
| POST | `/auth/password/reset` | Request password reset |
| POST | `/auth/password/confirm` | Confirm password reset |
| GET | `/auth/sessions` | List active sessions |
| GET | `/auth/admin/users` | List users (admin) |
| POST | `/auth/admin/users/:id/ban` | Ban user (admin) |

---

## Hooks

```typescript
const fortis = createFortis({
  hooks: {
    beforeLogin: async ({ email }) => {
      const banned = await db.isBanned(email)
      if (banned) throw new ForbiddenError('Account suspended')
    },
    afterRegister: async ({ user }) => {
      await crm.createContact(user)
    },
  },
})
```

---

## Webhooks

```typescript
const fortis = createFortis({
  webhooks: {
    url: 'https://yourapp.com/webhooks/auth',
    secret: process.env.WEBHOOK_SECRET,
    events: ['user.created', 'user.login', 'password.reset'],
  },
})
```

---

## Supported email adapters

| Adapter | Package |
|---------|---------|
| AWS SES | `@fortis/adapter-ses` |
| SMTP | `@fortis/adapter-smtp` |
| Resend | `@fortis/adapter-resend` |
| Sendgrid | `@fortis/adapter-sendgrid` |
| Postmark | `@fortis/adapter-postmark` |

---

## Supported database adapters

| Adapter | Package |
|---------|---------|
| DynamoDB | `@fortis/adapter-dynamodb` |
| Postgres | `@fortis/adapter-postgres` |
| MongoDB | `@fortis/adapter-mongodb` |

---

## Self-hosting on AWS

Full multi-region setup with Terraform:

```bash
cd infra/terraform/aws
terraform init
terraform apply -var="primary_region=us-east-1" \
                -var="regions=[\"us-east-1\",\"eu-west-2\",\"ap-southeast-2\"]"
```

See [self-hosting docs](./docs/self-hosting.md) for full guide.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).  
Writing a new adapter? See [docs/writing-an-adapter.md](./docs/writing-an-adapter.md).

---

## License

Apache 2.0
