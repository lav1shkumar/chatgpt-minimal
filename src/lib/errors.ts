export type ErrorCode =
  // Server-side (API routes)
  'invalid_json' | 'invalid_request' | 'internal_error'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  invalid_json: 400,
  invalid_request: 400,
  internal_error: 500
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = STATUS_BY_CODE[code]
  }

  toResponse(): Response {
    return Response.json({ code: this.code, message: this.message }, { status: this.statusCode })
  }
}
