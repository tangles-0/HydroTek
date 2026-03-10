// src/app/providers.tsx
"use client"

import { ResponseError } from "@/components/utils/parseResponse"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            throwOnError: true
          },
          mutations: {
            onError: error => {
              const message =
                error instanceof ResponseError
                  ? `${error.status.toString()}: ${error.statusText}`
                  : error instanceof Error
                    ? error.message
                    : "An unknown error occurred"

              console.error(message)
            }
          }
        }
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
