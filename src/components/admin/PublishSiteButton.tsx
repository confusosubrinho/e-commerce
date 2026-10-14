import { useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PUBLISH_EVENT, publishContentSnapshot, type PublishStatus } from '@/lib/staticContent';

const LABELS: Record<PublishStatus | 'idle', string> = {
  idle: 'Publicar no site',
  pending: 'Publicando...',
  publishing: 'Publicando...',
  published: 'Site atualizado',
  error: 'Tentar publicar de novo',
};

export function PublishSiteButton({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<PublishStatus | 'idle'>('idle');

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status: PublishStatus; message?: string }>).detail;
      setStatus(detail.status);
      if (detail.status === 'published') toast.success('Alterações publicadas no site.');
      if (detail.status === 'error') toast.error(`Não foi possível publicar no site: ${detail.message ?? 'erro desconhecido'}`);
    };
    window.addEventListener(PUBLISH_EVENT, onStatus);
    return () => window.removeEventListener(PUBLISH_EVENT, onStatus);
  }, []);

  const busy = status === 'pending' || status === 'publishing';

  const publish = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error('Sessão expirada. Entre novamente.');
      return;
    }
    await publishContentSnapshot(`Bearer ${token}`);
  };

  const Icon = busy ? Loader2 : status === 'published' ? CheckCircle2 : status === 'error' ? AlertTriangle : CloudUpload;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={publish}
      disabled={busy}
      title="Envia o conteúdo configurado no admin para o site"
      className={compact ? 'h-8 px-2 text-xs' : undefined}
    >
      <Icon className={`h-3.5 w-3.5 ${compact ? '' : 'mr-1.5'} ${busy ? 'animate-spin' : ''}`} />
      {!compact && LABELS[status]}
    </Button>
  );
}
