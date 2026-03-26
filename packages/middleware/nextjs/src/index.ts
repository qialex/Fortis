import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, type FortisInstance } from '@fortis/core'

export function createNextjsMiddleware(fortis: FortisInstance) {
  return function middleware(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.next()
    }

    try {
      const token = authHeader.replace('Bearer ', '')
      const payload = verifyAccessToken(token, fortis.config.jwt)
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-user-id', payload.sub)
      requestHeaders.set('x-user-email', payload.email)
      requestHeaders.set('x-session-id', payload.sessionId)
      return NextResponse.next({ request: { headers: requestHeaders } })
    } catch {
      return NextResponse.next()
    }
  }
}

// Route handler factory for App Router
export function nextjsHandler(fortis: FortisInstance) {
  async function POST(req: NextRequest, { params }: { params: { fortis: string[] } }) {
    const [action, ...rest] = params.fortis
    const body = await req.json()
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'

    const mockEvent = {
      body: JSON.stringify(body),
      headers: Object.fromEntries(req.headers.entries()),
      requestContext: { identity: { sourceIp: ip } },
    }

    let handler: (event: any) => Promise<any>

    switch (action) {
      case 'register': {
        const m = await import('../../server/lambda/register'); handler = m.handler; break
      }
      case 'login': {
        const m = await import('../../server/lambda/login'); handler = m.handler; break
      }
      case 'logout': {
        const m = await import('../../server/lambda/logout'); handler = m.handler; break
      }
      case 'logout-all': {
        const m = await import('../../server/lambda/logout-all'); handler = m.handler; break
      }
      default:
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const result = await handler(mockEvent)
    return NextResponse.json(JSON.parse(result.body), { status: result.statusCode })
  }

  return { POST }
}
