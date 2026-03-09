import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice, getProviderLabel } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Package, RefreshCw, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Order } from '@/types/database';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_snapshot?: string;
  title_snapshot?: string;
  variant_info?: string;
  sku_snapshot?: string;
}

interface OrderDetailContentProps {
  order: Order;
  orderItems: OrderItem[] | null;
  orderItemsLoading: boolean;
  syncYampiOrderId: string | null;
  reconcileOrderId: string | null;
  onSyncYampi: (id: string) => void;
  onReconcile: (id: string) => void;
  onDeleteTest: (order: Order) => void;
  onTrackingUpdated: (code: string) => void;
  TrackingEditor: React.ComponentType<{ order: Order; onUpdated: (code: string) => void }>;
}

function PaymentBadge({ order }: { order: Order }) {
  const ps = (order as any).payment_status;
  const st = order.status;
  const label =
    ps === 'refunded' ? 'Reembolsado'
    : ps === 'approved' || ['processing', 'shipped', 'delivered'].includes(st) ? 'Aprovado'
    : ps === 'pending' || st === 'pending' ? 'Pendente'
    : ps === 'failed' || st === 'cancelled' ? 'Não efetuado'
    : null;
  const style =
    label === 'Aprovado' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
    : label === 'Pendente' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
    : label === 'Não efetuado' || label === 'Reembolsado' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
    : 'bg-muted';
  return label ? <Badge className={style}>{label}</Badge> : null;
}

export function OrderDetailContent({
  order,
  orderItems,
  orderItemsLoading,
  syncYampiOrderId,
  reconcileOrderId,
  onSyncYampi,
  onReconcile,
  onDeleteTest,
  onTrackingUpdated,
  TrackingEditor,
}: OrderDetailContentProps) {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-5">
      {/* Customer info + badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{getProviderLabel((order as any).provider)}</Badge>
        <PaymentBadge order={order} />
      </div>

      {(order as any).customer_email && (
        <p className="text-sm text-muted-foreground">
          {(order as any).customer_email}
          {(order as any).customer_cpf && <> · CPF: {(order as any).customer_cpf}</>}
        </p>
      )}

      {(order as any).provider === 'yampi' && ((order as any).yampi_order_number || (order as any).external_reference) && (
        <p className="text-xs text-muted-foreground">
          {(order as any).yampi_order_number
            ? <>Yampi: <strong className="text-foreground">{(order as any).yampi_order_number}</strong></>
            : <>ID Yampi: {(order as any).external_reference}</>}
        </p>
      )}

      {/* Payment info grid */}
      <div className={`grid gap-3 text-sm ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
        <InfoCard label="Valor pago" value={order.total_amount != null ? formatPrice(Number(order.total_amount)) : '—'} />
        <InfoCard label="Método" value={(order as any).payment_method || '—'} />
        <InfoCard label="Gateway" value={(order as any).gateway || '—'} />
        <InfoCard label="Parcelas" value={(order as any).installments > 0 ? `${(order as any).installments}x` : '—'} />
      </div>

      {(order as any).shipping_method && (
        <div className="text-sm">
          <p className="text-muted-foreground text-xs font-medium mb-0.5">Envio</p>
          <p className="font-medium">{(order as any).shipping_method}</p>
        </div>
      )}

      {/* Order items */}
      {orderItemsLoading ? (
        <p className="text-sm text-muted-foreground">Carregando itens...</p>
      ) : orderItems && orderItems.length > 0 ? (
        <div>
          <h3 className="font-medium mb-2 text-sm">Itens do pedido</h3>
          {isMobile ? (
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 rounded-lg border bg-card">
                  {(item as any).image_snapshot ? (
                    <img
                      src={(item as any).image_snapshot}
                      alt=""
                      className="w-14 h-14 object-cover rounded-md border bg-muted flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-md border bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                      <Package className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">
                      {(item as any).title_snapshot || item.product_name}
                    </p>
                    {((item as any).variant_info || (item as any).sku_snapshot) && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {(item as any).variant_info || (item as any).sku_snapshot}
                      </p>
                    )}
                    <p className="text-sm mt-1 text-muted-foreground">
                      {item.quantity}x {formatPrice(Number(item.unit_price))}
                      <span className="font-semibold text-foreground ml-1">
                        = {formatPrice(Number(item.total_price))}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-xs font-medium text-left p-2 w-14">Foto</th>
                    <th className="text-xs font-medium text-left p-2">Produto</th>
                    <th className="text-xs font-medium text-left p-2 w-16">Qtd</th>
                    <th className="text-xs font-medium text-right p-2">Unit.</th>
                    <th className="text-xs font-medium text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-2">
                        {(item as any).image_snapshot ? (
                          <img src={(item as any).image_snapshot} alt="" className="w-10 h-10 object-cover rounded border bg-muted" />
                        ) : (
                          <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-muted-foreground">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <span className="font-medium">{(item as any).title_snapshot || item.product_name}</span>
                        {(item as any).variant_info && <span className="text-muted-foreground block text-xs">Variante: {(item as any).variant_info}</span>}
                        {(item as any).sku_snapshot && <span className="text-muted-foreground block text-xs">SKU: {(item as any).sku_snapshot}</span>}
                      </td>
                      <td className="p-2">{item.quantity}</td>
                      <td className="p-2 text-right">{formatPrice(Number(item.unit_price))}</td>
                      <td className="p-2 text-right font-medium">{formatPrice(Number(item.total_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Address + Summary */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div>
          <h3 className="font-medium mb-2 text-sm">Endereço de Entrega</h3>
          <div className="text-sm space-y-0.5">
            <p className="font-medium">{order.shipping_name ?? '—'}</p>
            <p className="text-muted-foreground">
              {order.shipping_address && <>{order.shipping_address}<br /></>}
              {(order.shipping_city || order.shipping_state) && <>{order.shipping_city}{order.shipping_state ? ` - ${order.shipping_state}` : ''}<br /></>}
              {order.shipping_zip && <>CEP: {order.shipping_zip}</>}
            </p>
            {order.shipping_phone && <p className="text-muted-foreground">Tel: {order.shipping_phone}</p>}
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2 text-sm">Resumo</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span>{formatPrice(Number(order.shipping_cost))}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Desconto</span>
                <span>-{formatPrice(Number(order.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total</span>
              <span>{formatPrice(Number(order.total_amount))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking */}
      <TrackingEditor order={order} onUpdated={onTrackingUpdated} />

      {/* Notes */}
      {order.notes && (
        <div>
          <h3 className="font-medium mb-1 text-sm">Observações</h3>
          <p className="text-sm text-muted-foreground">{order.notes}</p>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h3 className="font-medium mb-1.5 text-sm flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Timeline
        </h3>
        <ul className="text-xs space-y-1 text-muted-foreground">
          {(order as any).yampi_created_at && (
            <li>Compra (Yampi): {format(new Date((order as any).yampi_created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</li>
          )}
          <li>Criado: {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</li>
          <li>Atualizado: {format(new Date(order.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}{(order as any).last_webhook_event ? ` (${(order as any).last_webhook_event})` : ''}</li>
        </ul>
      </div>

      {/* Actions */}
      <div className={`space-y-2 pt-3 border-t ${isMobile ? '' : ''}`}>
        {(order as any).provider === 'yampi' && (order as any).external_reference && (
          <div>
            <Button
              variant="outline"
              size="sm"
              className={isMobile ? 'w-full' : ''}
              onClick={() => onSyncYampi(order.id)}
              disabled={syncYampiOrderId !== null}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncYampiOrderId === order.id ? 'animate-spin' : ''}`} />
              Sincronizar com Yampi
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">
              Atualiza status, pagamento e rastreio a partir da Yampi.
            </p>
          </div>
        )}

        {(order as any).provider === 'stripe' && (order as any).transaction_id && (
          <div>
            <Button
              variant="outline"
              size="sm"
              className={isMobile ? 'w-full' : ''}
              onClick={() => onReconcile(order.id)}
              disabled={reconcileOrderId !== null}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${reconcileOrderId === order.id ? 'animate-spin' : ''}`} />
              Conciliar com Stripe
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">
              Consulta o status do pagamento no Stripe.
            </p>
          </div>
        )}

        <div>
          <Button
            variant="outline"
            size="sm"
            className={`text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 ${isMobile ? 'w-full' : ''}`}
            onClick={() => onDeleteTest(order)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir pedido (modo teste)
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">
            Restaura estoque e remove o pedido. Apenas teste.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="text-muted-foreground text-[11px] font-medium mb-0.5">{label}</p>
      <p className="font-semibold text-sm truncate">{value}</p>
    </div>
  );
}
