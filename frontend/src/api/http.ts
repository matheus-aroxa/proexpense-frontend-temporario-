const DEFAULT_API_ORIGIN = 'https://proexpense-backend.onrender.com'

/**
 * Em desenvolvimento a API é chamada na mesma origem e o proxy do Vite repassa ao backend.
 * No build, chama o backend diretamente (VITE_API_BASE_URL, ou o Render por padrão);
 * defina VITE_API_BASE_URL vazio para usar a mesma origem atrás de um proxy reverso.
 */
const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_ORIGIN)
const API_BASE = `${API_ORIGIN.replace(/\/$/, '')}/api/v1`

/** Erro no formato ProblemDetail (RFC 9457) devolvido pelo GlobalExceptionHandler do backend. */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

interface ProblemDetail {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}

async function parseError(response: Response): Promise<ApiError> {
  let problem: ProblemDetail = {}
  try {
    problem = (await response.json()) as ProblemDetail
  } catch {
    // corpo vazio ou não-JSON
  }
  const message =
    problem.detail ?? problem.title ?? `Erro ${response.status} ao comunicar com o servidor`
  return new ApiError(response.status, message, problem.errors ?? {})
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Se o backend estava inativo, aguarde alguns segundos e tente novamente.')
  }

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Erro inesperado'
}
