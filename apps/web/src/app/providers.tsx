"use client";

import { ApiRequestError } from "@sagarnu/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Direction } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            // 4xx answers (not found, unauthorized) will not change by retrying.
            retry: (count, error) =>
              !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) && count < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <Direction.Provider dir="rtl">
        {children}
        <Toaster position="top-center" dir="rtl" richColors closeButton />
      </Direction.Provider>
    </QueryClientProvider>
  );
}
