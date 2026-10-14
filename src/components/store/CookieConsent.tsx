import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CONSENT_EVENT, getConsent, setConsent } from '@/lib/tracking';

function CookieConsentInner(_props: Record<string, never>, ref: React.ForwardedRef<HTMLDivElement>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = getConsent() ? undefined : setTimeout(() => setVisible(true), 1500);
    const onChange = () => setVisible(getConsent() === null);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(CONSENT_EVENT, onChange);
    };
  }, []);

  const choose = (value: 'accepted' | 'declined') => {
    setConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div ref={ref} className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-sm z-[9999] animate-fade-in" role="dialog" aria-label="Preferências de cookies">
      <div className="bg-background border border-border rounded-xl shadow-lg p-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Usamos cookies essenciais para a loja funcionar e, com a sua permissão, cookies de análise e
          marketing para medir visitas e mostrar ofertas relevantes. Saiba mais na nossa{' '}
          <Link to="/politica-privacidade" className="text-primary underline underline-offset-2">
            Política de Privacidade
          </Link>.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => choose('accepted')} className="flex-1">
            Aceitar
          </Button>
          <Button size="sm" variant="outline" onClick={() => choose('declined')}>
            Recusar
          </Button>
        </div>
      </div>
    </div>
  );
}

export const CookieConsent = React.forwardRef(CookieConsentInner);
