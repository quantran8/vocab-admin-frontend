import { QueryClient, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'
import { describeError } from './errors'

const MAX_QUERY_RETRIES = 2

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => error instanceof ApiError && error.retryable && count < MAX_QUERY_RETRIES,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})

export function toastError(error: unknown) {
  const { title, detail } = describeError(error)
  toast.error(title, { description: detail })
}

interface ApiMutationOptions<TVars, TData> {
  mutationFn: (vars: TVars) => Promise<TData>
  invalidate?: QueryKey[]
  success?: string
  onSuccess?: (data: TData) => void
  /** Set when the caller shows the error itself, such as on form fields. */
  silent?: boolean
}

export function useApiMutation<TVars = void, TData = unknown>({ mutationFn, invalidate = [], success, onSuccess, silent }: ApiMutationOptions<TVars, TData>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async (data) => {
      await Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey })))
      if (success) toast.success(success)
      onSuccess?.(data)
    },
    onError: silent ? undefined : toastError,
  })
}
