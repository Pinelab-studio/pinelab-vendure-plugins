import { defineDashboardExtension } from '@vendure/dashboard';
import { useEffect, useRef, useState } from 'react';

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
    const res = await fetch('/admin-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation {
          authenticate(input: { google: { credentialJWT: "${response.credential}" } }) {
            ... on CurrentUser { identifier }
            ... on ErrorResult { message }
          }
        }`,
      }),
    });
    const json = (await res.json()) as {
      data: { authenticate: { identifier?: string; message?: string } };
    };
    if (json.data.authenticate.message) {
      setError(json.data.authenticate.message);
      return;
    }
    const authToken = res.headers.get('Vendure-Auth-Token');
    if (authToken) {
      localStorage.setItem('vendure-session-token', `"${authToken}"`);
    }
    window.location.replace('/dashboard');
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
