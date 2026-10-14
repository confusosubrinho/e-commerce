import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ExternalLink, Image, Palette, FileText, Store, Megaphone, Newspaper, CloudUpload, ImagePlus, Monitor, Smartphone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { SHOPIFY_ADMIN_URL } from '@/lib/shopify/client';
import { PUBLISH_EVENT, REMOTE_SNAPSHOT_URL } from '@/lib/staticContent';
import { PublishSiteButton } from '@/components/admin/PublishSiteButton';

const contentLinks = [
  { title: 'Home Page', description: 'Seções, cabeçalho, rodapé e vídeos.', url: '/admin/personalizacao', icon: Palette },
  { title: 'Páginas', description: 'Conteúdo institucional da loja.', url: '/admin/paginas', icon: FileText },
  { title: 'Galeria de mídia', description: 'Imagens e arquivos do site.', url: '/admin/galeria', icon: Image },
];

type AnnouncementMessage = { text?: string | null };

function relative(date?: string | null) {
  return date ? formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR }) : null;
}

function usePublishedAt() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const onStatus = (event: Event) => {
      if ((event as CustomEvent<{ status: string }>).detail.status === 'published') {
        queryClient.invalidateQueries({ queryKey: ['dashboard-published-at'] });
      }
    };
    window.addEventListener(PUBLISH_EVENT, onStatus);
    return () => window.removeEventListener(PUBLISH_EVENT, onStatus);
  }, [queryClient]);

  return useQuery({
    queryKey: ['dashboard-published-at'],
    queryFn: async () => {
      const res = await fetch(`${REMOTE_SNAPSHOT_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const body = await res.json();
      return (body?.published_at as string | undefined) ?? null;
    },
  });
}

function useContentOverview() {
  return useQuery({
    queryKey: ['dashboard-content-overview'],
    queryFn: async () => {
      const [banners, highlights, announcement, posts] = await Promise.all([
        supabase.from('banners').select('id, title, image_url, is_active, show_on_desktop, show_on_mobile, display_order').order('display_order'),
        supabase.from('highlight_banners').select('id, is_active'),
        supabase.from('announcement_bar').select('is_active, messages').limit(1).maybeSingle(),
        supabase.from('blog_posts').select('id, status'),
      ]);
      const activeBanners = (banners.data ?? []).filter((b) => b.is_active);
      const messages = ((announcement.data?.messages ?? []) as AnnouncementMessage[])
        .map((m) => m.text?.trim())
        .filter((t): t is string => !!t);
      return {
        activeBanners,
        inactiveBanners: (banners.data?.length ?? 0) - activeBanners.length,
        activeHighlights: (highlights.data ?? []).filter((h) => h.is_active).length,
        announcementActive: !!announcement.data?.is_active,
        announcementMessages: messages,
        publishedPosts: (posts.data ?? []).filter((p) => p.status === 'published').length,
        draftPosts: (posts.data ?? []).filter((p) => p.status !== 'published').length,
      };
    },
  });
}

export default function Dashboard() {
  const { data: publishedAt, isLoading: loadingPublished } = usePublishedAt();
  const { data: overview, isLoading } = useContentOverview();
  const heroBanner = overview?.activeBanners[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administração do site</h1>
        <p className="text-muted-foreground">O que está no ar agora na loja.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CloudUpload className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Publicação no site</p>
              <p className="text-sm text-muted-foreground">
                {loadingPublished
                  ? 'Verificando...'
                  : publishedAt
                    ? `Última publicação ${relative(publishedAt)}. Alterações salvas são publicadas automaticamente.`
                    : 'Ainda não há publicação. Clique em “Publicar no site” para enviar o conteúdo atual.'}
              </p>
            </div>
          </div>
          <PublishSiteButton />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><ImagePlus className="h-5 w-5" />Banners da home</span>
              <Button variant="ghost" size="sm" asChild><Link to="/admin/banners">Gerenciar</Link></Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : heroBanner ? (
              <>
                <img src={heroBanner.image_url} alt={heroBanner.title ?? 'Banner principal'} className="h-24 w-full rounded-md object-cover" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{heroBanner.title || 'Sem título'}</span>
                  {heroBanner.show_on_desktop !== false && <Badge variant="secondary"><Monitor className="mr-1 h-3 w-3" />Desktop</Badge>}
                  {heroBanner.show_on_mobile !== false && <Badge variant="secondary"><Smartphone className="mr-1 h-3 w-3" />Mobile</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {overview.activeBanners.length} ativo(s) · {overview.inactiveBanners} inativo(s) · {overview.activeHighlights} banner(s) de destaque ativo(s)
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum banner ativo. A home está sem banner principal.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Megaphone className="h-5 w-5" />Barra de avisos</span>
                <Button variant="ghost" size="sm" asChild><Link to="/admin/personalizacao?tab=header">Editar</Link></Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {isLoading ? <Skeleton className="h-5 w-40" /> : (
                <>
                  <Badge variant={overview?.announcementActive ? 'default' : 'outline'}>
                    {overview?.announcementActive ? 'Ligada' : 'Desligada'}
                  </Badge>
                  {overview?.announcementMessages.map((m) => <p key={m} className="text-muted-foreground">“{m}”</p>)}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Newspaper className="h-5 w-5" />Blog</span>
                <Button variant="ghost" size="sm" asChild><Link to="/admin/blog">Abrir</Link></Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {isLoading ? <Skeleton className="h-5 w-40" /> : `${overview?.publishedPosts ?? 0} publicado(s) · ${overview?.draftPosts ?? 0} rascunho(s)`}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {contentLinks.map(({ title, description, url, icon: Icon }) => (
          <Card key={url}>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5" />{title}</CardTitle></CardHeader>
            <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{description}</p><Button variant="outline" size="sm" asChild><Link to={url}>Gerenciar</Link></Button></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Produtos, estoque, preços, pagamentos, pedidos e clientes são gerenciados na Shopify.</p>
          </div>
          <Button asChild size="sm"><a href={SHOPIFY_ADMIN_URL} target="_blank" rel="noopener noreferrer">Abrir Shopify<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
        </CardContent>
      </Card>
    </div>
  );
}
