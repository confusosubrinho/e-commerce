import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export default function AppmaxCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const externalKey = searchParams.get('external_key');
    if (!externalKey) {
      setStatus('error');
      setErrorMsg('Parâmetro external_key não encontrado na URL.');
      return;
    }

    async function finalize() {
      try {
        // Fetch installation token from DB
        const { data: installation, error: fetchErr } = await supabase
          .from('appmax_installations' as any)
          .select('installation_token, status')
          .eq('external_key', externalKey!)
          .eq('environment', 'sandbox')
          .maybeSingle();

        if (fetchErr) throw new Error(fetchErr.message);
        if (!installation) throw new Error('Instalação não encontrada.');
        if ((installation as any).status === 'connected') {
          setStatus('success');
          return;
        }

        const token = (installation as any).installation_token;
        if (!token) throw new Error('Token de instalação não encontrado.');

        // Call edge function to generate merchant keys
        const { data, error } = await supabase.functions.invoke('appmax-generate-merchant-keys', {
          body: { external_key: externalKey, token },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'Erro desconhecido ao finalizar conexão.');
      }
    }

    finalize();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Conexão Appmax</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Finalizando conexão...</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="font-medium text-green-700">Conectado com sucesso!</p>
              <p className="text-sm text-muted-foreground text-center">
                Suas credenciais foram geradas e salvas com segurança.
              </p>
              <Button onClick={() => navigate('/admin/integracoes')} className="mt-4">
                Voltar para Integrações
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="font-medium text-red-700">Erro na conexão</p>
              <p className="text-sm text-muted-foreground text-center">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate('/admin/integracoes')} className="mt-4">
                Voltar para Integrações
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
