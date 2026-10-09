import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'bad_request', details)
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, 'unauthorized')
  }
  static forbidden(message = 'Not allowed') {
    return new ApiError(403, message, 'forbidden')
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, message, 'not_found')
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError(409, message, 'conflict', details)
  }
  static unprocessable(message: string, details?: unknown) {
    return new ApiError(422, message, 'validation_error', details)
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } })
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    })
    return
  }

  if (error instanceof ApiError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message, details: error.details } })
    return
  }

  const httpish = error as { status?: number; type?: string }
  if (
    httpish &&
    typeof httpish.status === 'number' &&
    httpish.status >= 400 &&
    httpish.status < 500
  ) {
    res.status(httpish.status).json({
      error: { code: 'bad_request', message: 'Invalid request payload or parameters' },
    })
    return
  }

  const maybeMongo = error as { code?: number; keyValue?: Record<string, unknown> }
  if (maybeMongo && maybeMongo.code === 11000) {
    res.status(409).json({
      error: {
        code: 'conflict',
        message: 'A record with these unique values already exists',
        details: maybeMongo.keyValue,
      },
    })
    return
  }

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('[api] Unhandled error:', error)
  }
  res
    .status(500)
    .json({ error: { code: 'internal_error', message: 'An unexpected error occurred' } })
}
