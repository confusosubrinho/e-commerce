import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStoreSettingsPublic } from '@/hooks/useStoreContact';
import { CONSENT_EVENT, getConsent, loadTrackers, trackPageView } from '@/lib/tracking';

function isPrivateRoute(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/auth');
}

export function TrackingManager() {
  const location = useLocation();
  const { data: settings } = useStoreSettingsPublic();
  const [consent, setConsentState] = useState(getConsent);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => setConsentState(getConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (active || consent !== 'accepted' || !settings || isPrivateRoute(location.pathname)) return;
    setActive(
      loadTrackers({
        googleAnalyticsId: settings.google_analytics_id,
        facebookPixelId: settings.facebook_pixel_id,
        tiktokPixelId: settings.tiktok_pixel_id,
        headCode: settings.head_code,
        bodyCode: settings.body_code,
      }),
    );
  }, [active, consent, settings, location.pathname]);

  useEffect(() => {
    if (active && !isPrivateRoute(location.pathname)) trackPageView(location.pathname + location.search);
  }, [active, location.pathname, location.search]);

  return null;
}
