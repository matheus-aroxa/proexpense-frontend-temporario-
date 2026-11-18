import { ApiError, errorMessage } from '../api/http'

export type FieldErrors = Record<string, string>

/** Separa os erros por campo (ProblemDetail.errors) da mensagem geral. */
export function splitApiError(error: unknown): { fields: FieldErrors; message: string | null } {
  if (error instanceof ApiError) {
    const fields: FieldErrors = {}
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (messages[0]) fields[field] = messages[0]
    }
    const hasFields = Object.keys(fields).length > 0
    return { fields, message: hasFields ? null : error.message }
  }
  return { fields: {}, message: errorMessage(error) }
}
