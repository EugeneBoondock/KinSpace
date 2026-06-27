export type RpcErrorCode =
  | 'GUIDE_ALREADY_REPLIED'
  | 'PLAN_REQUIRED'
  | 'UNAUTHENTICATED'
  | 'NOT_AUTHORIZED'
  | 'REQUEST_FAILED'

export type RpcErrorBody = {
  ok: false
  error: string
  code: RpcErrorCode
  upgrade?: boolean
}

export type RpcErrorResponse = {
  status: number
  shouldLog: boolean
  body: RpcErrorBody
}

const GUIDE_ALREADY_REPLIED = 'This Guide has already replied to this post.'

export function rpcErrorResponse(error: unknown): RpcErrorResponse {
  const message = error instanceof Error ? error.message : ''

  if (message === 'UNAUTHENTICATED') {
    return {
      status: 401,
      shouldLog: false,
      body: { ok: false, error: 'Please sign in to continue.', code: 'UNAUTHENTICATED' },
    }
  }

  if (message === 'Not authorized') {
    return {
      status: 403,
      shouldLog: false,
      body: { ok: false, error: 'Not authorized.', code: 'NOT_AUTHORIZED' },
    }
  }

  if (message === 'PLAN_REQUIRED') {
    return {
      status: 402,
      shouldLog: false,
      body: {
        ok: false,
        error: 'Upgrade required for this feature.',
        code: 'PLAN_REQUIRED',
        upgrade: true,
      },
    }
  }

  if (message === GUIDE_ALREADY_REPLIED) {
    return {
      status: 409,
      shouldLog: false,
      body: { ok: false, error: GUIDE_ALREADY_REPLIED, code: 'GUIDE_ALREADY_REPLIED' },
    }
  }

  return {
    status: 500,
    shouldLog: true,
    body: { ok: false, error: 'Request failed. Please try again.', code: 'REQUEST_FAILED' },
  }
}
