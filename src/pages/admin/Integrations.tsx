import { useState } from 'react';
import { ExternalLink, Check, AlertCircle, Settings2, Plug, CreditCard, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'available' | 'coming_soon' | 'connected';
  category: 'erp' | 'payment' | 'shipping';
  configFields?: { key: string; label: string; placeholder: string; type?: string }[];
}

const integrations: Integration[] = [
  // ERP Integrations
  {
    id: 'bling',
    name: 'Bling ERP',
    description: 'Gestão completa de estoque, pedidos, notas fiscais e financeiro.',
    icon: <Package className="h-6 w-6" />,
    status: 'available',
    category: 'erp',
    configFields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Cole sua API Key do Bling' },
    ],
  },
  {
    id: 'tiny',
    name: 'Tiny ERP',
    description: 'Sistema de gestão empresarial com emissão de NF-e.',
    icon: <Package className="h-6 w-6" />,
    status: 'coming_soon',
    category: 'erp',
  },
  {
    id: 'omie',
    name: 'Omie',
    description: 'ERP online com gestão financeira e contábil integrada.',
    icon: <Package className="h-6 w-6" />,
    status: 'coming_soon',
    category: 'erp',
  },
  // Payment Gateways
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Receba pagamentos via PIX, cartão, boleto e muito mais.',
    icon: <CreditCard className="h-6 w-6" />,
    status: 'available',
    category: 'payment',
    configFields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'Cole seu Access Token de produção' },
      { key: 'public_key', label: 'Public Key', placeholder: 'Cole sua Public Key' },
    ],
  },
  {
    id: 'pagseguro',
    name: 'PagSeguro',
    description: 'Gateway de pagamentos com checkout transparente.',
    icon: <CreditCard className="h-6 w-6" />,
    status: 'coming_soon',
    category: 'payment',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Plataforma de pagamentos global para internet.',
    icon: <CreditCard className="h-6 w-6" />,
    status: 'coming_soon',
    category: 'payment',
  },
  {
    id: 'pix',
    name: 'PIX Direto',
    description: 'Receba pagamentos PIX diretamente na sua conta.',
    icon: <CreditCard className="h-6 w-6" />,
    status: 'available',
    category: 'payment',
    configFields: [
      { key: 'pix_key', label: 'Chave PIX', placeholder: 'CPF, CNPJ, email ou celular' },
      { key: 'pix_name', label: 'Nome do Beneficiário', placeholder: 'Nome que aparece no PIX' },
    ],
  },
  // Shipping Integrations  
  {
    id: 'melhor_envio',
    name: 'Melhor Envio',
    description: 'Calcule frete e gere etiquetas de diversas transportadoras.',
    icon: <Truck className="h-6 w-6" />,
    status: 'available',
    category: 'shipping',
    configFields: [
      { key: 'token', label: 'Token de Acesso', placeholder: 'Cole seu token do Melhor Envio' },
      { key: 'sandbox', label: 'Modo Sandbox', placeholder: 'true ou false', type: 'checkbox' },
    ],
  },
  {
    id: 'correios',
    name: 'Correios',
    description: 'Integração direta com os Correios para cálculo de frete.',
    icon: <Truck className="h-6 w-6" />,
    status: 'coming_soon',
    category: 'shipping',
  },
];

export default function Integrations() {
  const { toast } = useToast();
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  const handleSaveConfig = async (integrationId: string) => {
    // Here we would save to Supabase
    toast({
      title: 'Configuração salva!',
      description: 'A integração foi configurada com sucesso.',
    });
    setConfiguring(null);
    setConfigValues({});
  };

  const categories = [
    { id: 'erp', name: 'ERP & Gestão', icon: <Package className="h-5 w-5" /> },
    { id: 'payment', name: 'Pagamentos', icon: <CreditCard className="h-5 w-5" /> },
    { id: 'shipping', name: 'Frete & Envio', icon: <Truck className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">Conecte sua loja com ERPs, gateways de pagamento e transportadoras.</p>
      </div>

      {categories.map((category) => (
        <div key={category.id} className="space-y-4">
          <div className="flex items-center gap-2">
            {category.icon}
            <h2 className="text-lg font-semibold">{category.name}</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrations
              .filter((i) => i.category === category.id)
              .map((integration) => (
                <Card key={integration.id} className={integration.status === 'coming_soon' ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          {integration.icon}
                        </div>
                        <div>
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          {integration.status === 'coming_soon' && (
                            <Badge variant="secondary" className="text-xs mt-1">Em breve</Badge>
                          )}
                          {integration.status === 'connected' && (
                            <Badge className="bg-success text-success-foreground text-xs mt-1">
                              <Check className="h-3 w-3 mr-1" />
                              Conectado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription>{integration.description}</CardDescription>
                    
                    {configuring === integration.id && integration.configFields && (
                      <div className="space-y-3 pt-3 border-t">
                        {integration.configFields.map((field) => (
                          <div key={field.key} className="space-y-1.5">
                            <Label htmlFor={field.key} className="text-sm">{field.label}</Label>
                            {field.type === 'checkbox' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={field.key}
                                  checked={configValues[field.key] === 'true'}
                                  onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.checked ? 'true' : 'false' })}
                                  className="rounded"
                                />
                                <span className="text-sm text-muted-foreground">{field.placeholder}</span>
                              </div>
                            ) : (
                              <Input
                                id={field.key}
                                placeholder={field.placeholder}
                                value={configValues[field.key] || ''}
                                onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                              />
                            )}
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" onClick={() => handleSaveConfig(integration.id)}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfiguring(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {configuring !== integration.id && (
                      <Button
                        variant={integration.status === 'available' ? 'default' : 'secondary'}
                        size="sm"
                        className="w-full"
                        disabled={integration.status === 'coming_soon'}
                        onClick={() => setConfiguring(integration.id)}
                      >
                        {integration.status === 'connected' ? (
                          <>
                            <Settings2 className="h-4 w-4 mr-2" />
                            Configurar
                          </>
                        ) : integration.status === 'available' ? (
                          <>
                            <Plug className="h-4 w-4 mr-2" />
                            Conectar
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Em breve
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <ExternalLink className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Precisa de outra integração?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Entre em contato conosco para solicitar novas integrações com ERPs, gateways de pagamento ou transportadoras.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="https://wa.me/5542991120205?text=Olá, preciso de uma integração personalizada" target="_blank" rel="noopener noreferrer">
                  Solicitar Integração
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
