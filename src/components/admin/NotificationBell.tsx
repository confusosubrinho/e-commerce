import { useRef, useEffect } from 'react';
import { Bell, ShoppingCart, PackageX, Star, UserPlus, CreditCard, Info, MessageCircle, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { useBrowserNotificationPermission } from '@/hooks/useBrowserNotificationPermission';
import { showBrowserNotification } from '@/lib/browserNotifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_ICONS: Record<string, typeof Bell> = {
  new_order: ShoppingCart,
  order_paid: CreditCard,
  low_stock: PackageX,
  new_review: Star,
  new_customer: UserPlus,
  cart_recovered: MessageCircle,
  system: Info,
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notifications } = useNotifications(10);
  const { data: unreadCount } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const { supported: browserNotifySupported, permission: browserPermission, requestPermission, isRequesting } = useBrowserNotificationPermission();
  const prevUnreadCountRef = useRef<number | null>(null);
  const initialLoadRef = useRef(true);

  // Disparar notificação nativa do navegador quando chegar nova notificação (após carga inicial)
  useEffect(() => {
    const count = unreadCount ?? 0;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      prevUnreadCountRef.current = count;
      return;
    }
    const prev = prevUnreadCountRef.current ?? 0;
    prevUnreadCountRef.current = count;
    if (count <= prev || count === 0 || !notifications?.length) return;
    if (browserPermission !== 'granted') return;
    const latestUnread = notifications.find((n) => !n.is_read);
    if (!latestUnread) return;
    showBrowserNotification(latestUnread.title, {
      body: latestUnread.message,
      link: latestUnread.link ?? undefined,
      tag: latestUnread.id,
    });
  }, [unreadCount, notifications, browserPermission]);

  const handleClick = (n: typeof notifications extends (infer T)[] ? T : never) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  const handleRequestBrowserNotify = async () => {
    await requestPermission();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount! > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Notificações</span>
          {(unreadCount ?? 0) > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllAsRead.mutate()}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {!notifications?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left flex gap-3 p-3 hover:bg-muted/50 transition-colors border-b last:border-0",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className={cn("mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    n.type === 'new_order' || n.type === 'order_paid' ? 'bg-green-100 text-green-600' :
                    n.type === 'low_stock' ? 'bg-red-100 text-red-600' :
                    n.type === 'new_review' ? 'bg-yellow-100 text-yellow-600' :
                    n.type === 'cart_recovered' ? 'bg-blue-100 text-blue-600' :
                    n.type === 'system' ? 'bg-slate-100 text-slate-600' :
                    'bg-blue-100 text-blue-600'
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", !n.is_read && "font-semibold")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
                </button>
              );
            })
          )}
        </ScrollArea>
        <div className="p-2 border-t space-y-1">
          {browserNotifySupported && browserPermission !== 'granted' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs justify-start gap-2"
              onClick={handleRequestBrowserNotify}
              disabled={isRequesting || browserPermission === 'denied'}
            >
              <BellRing className="h-3.5 w-3.5" />
              {browserPermission === 'default'
                ? (isRequesting ? 'Solicitando...' : 'Ativar notificações do navegador')
                : 'Notificações bloqueadas (ative nas configurações do site)'}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/admin/notificacoes')}>
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
