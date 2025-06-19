import { Signal, signal, useComputed, useSignalEffect } from "@preact/signals";
import { ComponentChildren } from "preact";
import { createContext } from "preact/compat";
import { useAttribute } from "./attributes";
import { useServerLocation } from "./server-location";
import { useContextSafely } from "../utils/useContextSafely";

const SignedUrlContext = createContext<{
  signedUrl: Signal<string | null>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;
} | null>(null);

interface SignedUrlProviderProps {
  children: ComponentChildren;
}

export function SignedUrlProvider({ children }: SignedUrlProviderProps) {
  const agentId = useAttribute("agent-id");
  const providedSignedUrl = useAttribute("signed-url");
  const { serverUrl } = useServerLocation();
  
  const signedUrl = signal<string | null>(null);
  const isLoading = signal(false);
  const error = signal<string | null>(null);

  // If signed URL is already provided, use it
  useSignalEffect(() => {
    if (providedSignedUrl.value) {
      signedUrl.value = providedSignedUrl.value;
      return;
    }
  });

  // Fetch signed URL if we have agent-id but no signed-url
  useSignalEffect(() => {
    if (!agentId.value || providedSignedUrl.value) {
      return;
    }

    const fetchSignedUrl = async () => {
      isLoading.value = true;
      error.value = null;

      try {
        // Use the proxy endpoint that includes authentication
        const response = await fetch(
          `${serverUrl.value}/lexiq/voice/eleven/conversation/signed-url?agent_id=${agentId.value}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch signed URL: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.signedUrl) {
          throw new Error('Response does not contain signedUrl');
        }

        signedUrl.value = data.signedUrl;
      } catch (err: any) {
        console.error('[ConversationalAI] Failed to fetch signed URL:', err);
        error.value = err.message || 'Failed to fetch signed URL';
      } finally {
        isLoading.value = false;
      }
    };

    fetchSignedUrl();
  });

  // Create a computed signal that returns either the fetched or provided signed URL
  const finalSignedUrl = useComputed(() => {
    return providedSignedUrl.value || signedUrl.value;
  });

  const value = {
    signedUrl: finalSignedUrl,
    isLoading,
    error,
  };

  return (
    <SignedUrlContext.Provider value={value}>
      {children}
    </SignedUrlContext.Provider>
  );
}

export function useSignedUrl() {
  return useContextSafely(SignedUrlContext);
} 