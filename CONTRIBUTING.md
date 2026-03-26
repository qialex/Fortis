# Contributing to Fortis

Thanks for your interest. Fortis is an auth library — security and correctness matter above all else.

## Getting started

```bash
git clone https://github.com/your-org/fortis
cd fortis
pnpm install
pnpm build
pnpm test
```

Local auth server with DynamoDB Local and Mailhog:

```bash
docker compose -f infra/docker/docker-compose.yml up
```

## What to work on

Check the GitHub Issues tab. Good first issues are labelled `good first issue`.

High-value contributions:
- New database adapters (Postgres, MongoDB)
- New email adapters (Sendgrid, Postmark)
- New SDK language (Python, Go)
- Bug fixes with reproduction test cases
- Documentation improvements

## Writing a new adapter

See `docs/writing-an-adapter.md`. The short version:

1. Create `packages/adapters/<type>/<name>/src/index.ts`
2. Implement the `DatabaseAdapter` or `EmailAdapter` interface from `@fortis/core`
3. Add tests
4. Add an example in `examples/`

## Pull request checklist

- [ ] Tests pass (`pnpm test`)
- [ ] New code has test coverage
- [ ] No new dependencies in `@fortis/core` — it must stay dependency-light
- [ ] Security-sensitive changes include a description of the threat model

## Security issues

Do **not** open a public issue for security vulnerabilities.
See [SECURITY.md](./SECURITY.md).

## License

By contributing you agree your code will be licensed under Apache 2.0.
