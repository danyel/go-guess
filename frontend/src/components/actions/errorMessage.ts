import { ApiError } from '../../api/client'

export function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong'
}
