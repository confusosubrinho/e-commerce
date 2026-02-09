import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailAutomation {
  id: string;
  automation_type: string;
  trigger_event: string;
  delay_minutes: number;
  email_subject: string;
  is_active: boolean;
}

const typeLabels: Record<string, string> = {
  abandoned_cart: 'Carrinho Abandonado',
  birthday: 'Aniversário',
  post_purchase: 'Pós-Compra',
  welcome: 'Boas-vindas',
};

const triggerLabels: Record<string, string> = {
  cart_abandoned: 'Carrinho abandonado',
  customer_birthday: 'Data de aniversário',
  order_delivered: 'Pedido entregue',
  user_signup: 'Novo cadastro',
};

export default function EmailAutomations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: automations, isLoading } = useQuery({
    queryKey: ['email-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_automations' as any)
        .select('*')
        .order('automation_type', { ascending: true });
      if (error) throw error;
      return data as unknown as EmailAutomation[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('email_automations' as any)
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-automations'] });
      toast({ title: 'Automação atualizada!' });
    },
  });

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return 'Imediato';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)} dias`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" />
          Automações de Email
        </h1>
        <p className="text-muted-foreground">Configure disparos automáticos de email</p>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm">Configuração pendente</p>
          <p className="text-sm text-muted-foreground">
            Para ativar os disparos automáticos, é necessário configurar um serviço de email (Resend, SendGrid, etc). 
            As automações abaixo estão preparadas e podem ser ativadas assim que o token de email for configurado nas integrações.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Delay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ativar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(automations || []).map(auto => (
                <TableRow key={auto.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {typeLabels[auto.automation_type] || auto.automation_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {triggerLabels[auto.trigger_event] || auto.trigger_event}
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">
                    {auto.email_subject}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDelay(auto.delay_minutes)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={auto.is_active ? 'default' : 'secondary'}>
                      {auto.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={auto.is_active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: auto.id, is_active: checked })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
