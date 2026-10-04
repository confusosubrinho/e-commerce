import { useState } from 'react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { PageSEO } from '@/components/seo/PageSEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStoreSettingsPublic, getWhatsAppNumber } from '@/hooks/useStoreContact';

export default function RastreioPage() {
  const [code, setCode] = useState('');
  const { data: settings } = useStoreSettingsPublic();
  const whatsapp = getWhatsAppNumber(settings?.contact_whatsapp);
  return <StoreLayout>
    <PageSEO title="Rastrear pedido | Vanessa Lima Shoes" path="/rastreio" noindex />
    <div className="container-custom py-12 max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Rastreie seu pedido</h1>
      <p className="text-muted-foreground">Use o código de rastreio recebido por email após o envio. Consulte a confirmação enviada pelo checkout para os detalhes da compra.</p>
      <form className="flex gap-3" onSubmit={event => { event.preventDefault(); if (code.trim()) window.open('https://www.linkcorreios.com.br/?id=' + encodeURIComponent(code.trim()), '_blank', 'noopener,noreferrer'); }}>
        <Input aria-label="Código de rastreio" placeholder="Código de rastreio" value={code} onChange={event => setCode(event.target.value)} required />
        <Button type="submit">Rastrear</Button>
      </form>
      {whatsapp && <Button asChild variant="outline"><a href={'https://wa.me/' + whatsapp} target="_blank" rel="noopener noreferrer">Preciso de ajuda com meu pedido</a></Button>}
    </div>
  </StoreLayout>;
}
