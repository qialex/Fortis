export class FortisError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'FortisError'
  }
}

export class UnauthorizedError extends FortisError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class ForbiddenError extends FortisError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
  }
}

export class NotFoundError extends FortisError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404)
  }
}

export class ConflictError extends FortisError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT', 409)
  }
}

export class ValidationError extends FortisError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 422)
  }
}

export class RateLimitError extends FortisError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMITED', 429)
  }
}
