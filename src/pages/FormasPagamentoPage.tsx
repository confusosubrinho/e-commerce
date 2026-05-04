import { StoreLayout } from '@/components/store/StoreLayout';
import { CreditCard, QrCode, FileText, ShieldCheck } from 'lucide-react';

export default function FormasPagamentoPage() {
  return (
    <StoreLayout>
      <div className="container-custom py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Formas de Pagamento</h1>
          <p className="text-muted-foreground mb-10">
            As condições exatas (descontos, parcelamento e juros) são exibidas no checkout no momento da compra.
          </p>

          <div className="space-y-6">
            <div className="p-6 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">PIX</h3>
              </div>
              <p className="text-muted-foreground">
                Pagamento instantâneo. O QR Code é gerado no checkout e a confirmação é imediata.
              </p>
            </div>

            <div className="p-6 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Cartão de Crédito</h3>
              </div>
              <p className="text-muted-foreground mb-3">
                Aceitamos as principais bandeiras. As opções de parcelamento aparecem no checkout.
              </p>
              <div className="flex gap-2 flex-wrap">
                {['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard'].map((brand) => (
                  <span key={brand} className="px-3 py-1 bg-muted rounded-full text-sm">
                    {brand}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Boleto Bancário</h3>
              </div>
              <p className="text-muted-foreground">
                Disponível no checkout. A compensação ocorre em até 3 dias úteis após o pagamento.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Pagamento 100% seguro</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Todo o processamento acontece em ambiente seguro e criptografado, com proteção antifraude.
              </p>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
