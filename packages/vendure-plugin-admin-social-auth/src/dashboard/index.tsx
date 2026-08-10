import { api, defineDashboardExtension } from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useEffect, useRef, useState } from 'react';

const authenticateWithGoogleDocument = graphql(`
  mutation AuthenticateWithGoogle($token: String!) {
    authenticate(input: { google: { credentialJWT: $token } }) {
      ... on CurrentUser {
        identifier
      }
      ... on ErrorResult {
        message
      }
    }
  }
`);

function GoogleLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    fetch('/social-auth/config')
      .then((r) => r.json())
      .then((data: unknown) => {
        const { googleClientId } = data as {
          googleClientId: string | undefined;
        };
        if (!googleClientId) return;

        if (
          !document.querySelector(
            'script[src*="accounts.google.com/gsi/client"]'
          )
        ) {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          document.head.appendChild(script);
        }

        interval = setInterval(() => {
          if (!(window as any).google?.accounts?.id) return;
          clearInterval(interval);

          (window as any).google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleCredentialResponse,
            ux_mode: 'popup',
            context: 'signin',
            auto_prompt: false,
          });

          if (containerRef.current) {
            (window as any).google.accounts.id.renderButton(
              containerRef.current,
              {
                type: 'standard',
                shape: 'rectangular',
                theme: 'outline',
                text: 'signin_with',
                size: 'large',
                logo_alignment: 'left',
                width: containerRef.current.offsetWidth,
              }
            );
          }
        }, 100);
      });

    return () => clearInterval(interval);
  }, []);

  async function handleCredentialResponse(response: { credential: string }) {
    try {
      // api.mutate() automatically captures the Vendure-Auth-Token response
      // header and stores it in localStorage, so no manual token handling
      // is needed here.
      const result = await api.mutate(authenticateWithGoogleDocument, {
        token: response.credential,
      });
      if ('message' in result.authenticate) {
        setError(result.authenticate.message);
        return;
      }
      window.location.replace('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to sign in with Google');
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full mt-2">
      <div ref={containerRef} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

defineDashboardExtension({
  login: {
    afterForm: {
      component: GoogleLoginButton,
    },
  },
});
