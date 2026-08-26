export type AppApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'cors'
  | 'unsupported-version'
  | 'unknown'

export class AppApiError extends Error {
  readonly kind: AppApiErrorKind
  readonly status?: number
  readonly code?: string | number
  readonly details?: unknown

  constructor(input: {
    kind: AppApiErrorKind
    message: string
    status?: number
    code?: string | number
    details?: unknown
    cause?: unknown
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause })
    this.name = 'AppApiError'
    this.kind = input.kind
    this.status = input.status
    this.code = input.code
    this.details = input.details
  }
}

function kindFromStatus(status: number): AppApiErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  if (status === 400 || status === 422) return 'validation'
  if (status >= 500 && status <= 599) return 'server'
  return 'unknown'
}

function grpcFields(body: unknown): { code?: string | number; details?: unknown } {
  if (!body || typeof body !== 'object') return {}
  const record = body as { code?: unknown; message?: unknown; details?: unknown }
  const code =
    typeof record.code === 'string' || typeof record.code === 'number' ? record.code : undefined
  return { code, details: body }
}

export function mapHttpFailure(input: {
  status?: number
  body?: unknown
  networkError?: unknown
  timedOut?: boolean
  cors?: boolean
}): AppApiError {
  if (input.timedOut) {
    return new AppApiError({
      kind: 'timeout',
      message: 'Request timed out',
      cause: input.networkError,
    })
  }
  if (input.cors) {
    return new AppApiError({ kind: 'cors', message: 'Blocked by CORS', cause: input.networkError })
  }
  if (input.networkError && input.status === undefined) {
    return new AppApiError({
      kind: 'network',
      message: 'Network request failed',
      cause: input.networkError,
    })
  }
  if (input.status !== undefined) {
    const grpc = grpcFields(input.body)
    return new AppApiError({
      kind: kindFromStatus(input.status),
      message: `HTTP ${input.status}`,
      status: input.status,
      code: grpc.code,
      details: grpc.details ?? input.body,
    })
  }
  return new AppApiError({
    kind: 'unknown',
    message: 'Unknown request failure',
    cause: input.networkError,
  })
}
