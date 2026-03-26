import type { Request, Response, NextFunction, RequestHandler } from 'express'
import {
  verifyAccessToken,
  UnauthorizedError,
  type FortisInstance,
} from '@fortis/core'

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
        sessionId: string
      }
    }
  }
}

export function fortisMiddleware(fortis: FortisInstance): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return next()

    try {
      const token = authHeader.replace('Bearer ', '')
      const payload = verifyAccessToken(token, fortis.config.jwt)
      req.user = {
        userId: payload.sub,
        email: payload.email,
        sessionId: payload.sessionId,
      }
      next()
    } catch {
      next()
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

export function fortisRouter(fortis: FortisInstance) {
  const { Router } = require('express')
  const router = Router()

  router.post('/auth/register', async (req: Request, res: Response) => {
    const { handler } = await import('../../server/lambda/register')
    const result = await handler({ body: JSON.stringify(req.body), headers: req.headers, requestContext: { identity: { sourceIp: req.ip } } })
    res.status(result.statusCode).json(JSON.parse(result.body))
  })

  router.post('/auth/login', async (req: Request, res: Response) => {
    const { handler } = await import('../../server/lambda/login')
    const result = await handler({ body: JSON.stringify(req.body), headers: req.headers, requestContext: { identity: { sourceIp: req.ip } } })
    res.status(result.statusCode).json(JSON.parse(result.body))
  })

  router.post('/auth/token/refresh', async (req: Request, res: Response) => {
    const { handler } = await import('../../server/lambda/refresh')
    const result = await handler({ body: JSON.stringify(req.body), headers: req.headers })
    res.status(result.statusCode).json(JSON.parse(result.body))
  })

  router.post('/auth/logout', requireAuth, async (req: Request, res: Response) => {
    const { handler } = await import('../../server/lambda/logout')
    const result = await handler({ body: JSON.stringify(req.body), headers: req.headers })
    res.status(result.statusCode).json(JSON.parse(result.body))
  })

  return router
}
