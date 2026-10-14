import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HomeSectionsManager } from '@/components/admin/HomeSectionsManager';
import { HomePageBuilder } from '@/components/admin/HomePageBuilder';
import { LayoutGrid, CreditCard, Sparkles, PanelTop, MessageSquareQuote, Layers } from 'lucide-react';
import { TestimonialsManager } from '@/components/admin/TestimonialsManager';
import { FeaturesBarManager } from '@/components/admin/FeaturesBarManager';
import { FooterCustomizer } from '@/components/admin/FooterCustomizer';
import { HeaderCustomizer } from '@/components/admin/HeaderCustomizer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { compressImageToWebP } from '@/lib/imageCompressor';
import { normalizeSupabaseMediaUrl } from '@/lib/imageUrl';
import { Plus, Pencil, Trash2, GripVertical, Upload, Video } from 'lucide-react';

// ─── Instagram Videos Section ───

interface InstagramVideo {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  username: string | null;
  product_handle?: string | null;
  display_order: number | null;
  is_active: boolean | null;
}

function InstagramVideosSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<InstagramVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [failedListThumbIds, setFailedListThumbIds] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<{ video_url?: string; thumbnail_url?: string }>({});
  const [formData, setFormData] = useState({
    video_url: '', thumbnail_url: '', username: '', product_handle: '', is_active: true,
  });
  const { data: shopifyProducts } = useShopifyProducts({ first: 250, sortKey: 'TITLE' });
  const productTitleByHandle = new Map((shopifyProducts ?? []).map((p) => [p.node.handle, p.node.title]));

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Erro inesperado';
  };

  const normalizeMediaUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    return normalizeSupabaseMediaUrl(trimmed);
  };

  const isLikelyIncompatibleVideoUrl = (value: string): boolean => {
    const normalized = normalizeMediaUrl(value).toLowerCase();
    if (!normalized) return false;
    return normalized.includes('.webm');
  };

  const isKnownPageVideoUrl = (value: string): boolean => {
    const normalized = normalizeMediaUrl(value).toLowerCase();
    if (!normalized) return false;
    return (
      normalized.includes('instagram.com/reel/') ||
      normalized.includes('instagram.com/p/') ||
      normalized.includes('youtube.com/watch') ||
      normalized.includes('youtu.be/') ||
      normalized.includes('tiktok.com/')
    );
  };

  const isSupportedVideoUpload = (file: File): boolean => {
    const lowerName = file.name.toLowerCase();
    const mime = file.type.toLowerCase();
    const byExt = lowerName.endsWith('.mp4');
    const byMime = mime === 'video/mp4';
    return byExt || byMime;
  };

  const isValidHttpUrl = (value: string): boolean => {
    try {
      const u = new URL(value.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const probeMediaUrl = async (kind: 'video' | 'image', url: string, timeoutMs = 6000): Promise<boolean> => {
    const normalized = normalizeMediaUrl(url);
    if (!normalized) return false;
    if (!isValidHttpUrl(normalized)) return false;

    return await new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      const timeout = window.setTimeout(() => finish(false), timeoutMs);

      if (kind === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          finish(true);
        };
        video.onerror = () => {
          window.clearTimeout(timeout);
          finish(false);
        };
        video.src = normalized;
      } else {
        const img = new Image();
        img.onload = () => {
          window.clearTimeout(timeout);
          finish(true);
        };
        img.onerror = () => {
          window.clearTimeout(timeout);
          finish(false);
        };
        img.src = normalized;
      }
    });
  };

  const validateFormData = async (): Promise<boolean> => {
    const nextErrors: { video_url?: string; thumbnail_url?: string } = {};
    const videoUrl = normalizeMediaUrl(formData.video_url);
    const thumbnailUrl = normalizeMediaUrl(formData.thumbnail_url);

    if (!videoUrl) {
      nextErrors.video_url = 'Informe a URL do vídeo ou faça upload.';
    } else if (!isValidHttpUrl(videoUrl)) {
      nextErrors.video_url = 'A URL do vídeo deve começar com http:// ou https://.';
    } else if (isKnownPageVideoUrl(videoUrl)) {
      nextErrors.video_url = 'Use URL direta do arquivo de vídeo (MP4). Link de Reel/post não é reproduzível no player.';
    } else if (isLikelyIncompatibleVideoUrl(videoUrl)) {
      nextErrors.video_url = 'Formato WebM pode falhar em alguns dispositivos. Use MP4 (H.264) para máxima compatibilidade.';
    } else {
      const videoOk = await probeMediaUrl('video', videoUrl);
      if (!videoOk) {
        nextErrors.video_url = 'Não foi possível carregar este vídeo. Verifique a URL no painel.';
      }
    }

    if (thumbnailUrl) {
      if (!isValidHttpUrl(thumbnailUrl)) {
        nextErrors.thumbnail_url = 'A thumbnail deve começar com http:// ou https://.';
      } else {
        const thumbOk = await probeMediaUrl('image', thumbnailUrl);
        if (!thumbOk) {
          nextErrors.thumbnail_url = 'Não foi possível carregar esta thumbnail. Verifique a URL.';
        }
      }
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const { data: videos, isLoading } = useQuery({
    queryKey: ['admin-instagram-videos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('instagram_videos').select('*').order('display_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as InstagramVideo[]) || [];
    },
  });


  const handleVideoUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      if (!isSupportedVideoUpload(file)) {
        toast({
          title: 'Formato não suportado',
          description: 'Use vídeo em MP4 (H.264) para compatibilidade no site.',
          variant: 'destructive',
        });
        return;
      }
      const maxSize = 30 * 1024 * 1024; // 30MB limit
      if (file.size > maxSize) {
        toast({
          title: 'Vídeo muito grande',
          description: 'Use um vídeo MP4/MOV de até 30MB para evitar incompatibilidade no site.',
          variant: 'destructive',
        });
        return;
      }
      const ext = file.name.split('.').pop() || 'mp4';
      const fileName = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-media').upload(fileName, file, { contentType: file.type || 'video/mp4' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-media').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, video_url: publicUrl }));
      setFieldErrors((prev) => ({ ...prev, video_url: undefined }));
      toast({ title: 'Vídeo enviado!' });
    } catch (error: unknown) {
      toast({ title: 'Erro ao enviar', description: getErrorMessage(error), variant: 'destructive' });
    } finally { setUploading(false); }
  }, [toast]);

  const handleThumbUpload = useCallback(async (file: File) => {
    setUploadingThumb(true);
    try {
      const { file: compressedFile, fileName } = await compressImageToWebP(file);
      const { error: uploadError } = await supabase.storage.from('product-media').upload(fileName, compressedFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-media').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, thumbnail_url: publicUrl }));
      setFieldErrors((prev) => ({ ...prev, thumbnail_url: undefined }));
      toast({ title: 'Thumbnail enviada!' });
    } catch (error: unknown) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally { setUploadingThumb(false); }
  }, [toast]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const normalizedVideoUrl = normalizeMediaUrl(data.video_url);
      const normalizedThumbUrl = normalizeMediaUrl(data.thumbnail_url);
      const videoData: {
        video_url: string;
        thumbnail_url: string | null;
        username: string | null;
        product_handle: string | null;
        is_active: boolean;
        display_order: number | null;
      } = {
        video_url: normalizedVideoUrl,
        thumbnail_url: normalizedThumbUrl || null,
        username: data.username.replace(/^@+/, '').trim() || null,
        product_handle: data.product_handle || null,
        is_active: data.is_active,
        display_order: editingVideo?.display_order || (videos?.length || 0),
      };
      if (editingVideo) {
        const { error } = await supabase.from('instagram_videos').update(videoData).eq('id', editingVideo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('instagram_videos').insert(videoData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instagram-videos'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-videos'] });
      setIsDialogOpen(false); resetForm();
      toast({ title: editingVideo ? 'Vídeo atualizado!' : 'Vídeo adicionado!' });
    },
    onError: (error: unknown) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('instagram_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instagram-videos'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-videos'] });
      toast({ title: 'Vídeo excluído!' });
    },
  });

  const resetForm = () => {
    setFormData({ video_url: '', thumbnail_url: '', username: '', product_handle: '', is_active: true });
    setFieldErrors({});
    setEditingVideo(null);
  };

  const handleEdit = (video: InstagramVideo) => {
    setEditingVideo(video);
    setFormData({
      video_url: video.video_url, thumbnail_url: video.thumbnail_url || '',
      username: video.username || '', product_handle: video.product_handle || '', is_active: video.is_active !== false,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vídeos Inspire-se</h3>
          <p className="text-sm text-muted-foreground">Vídeos exibidos na seção "Inspire-se" da home. Use MP4 (H.264), até 30MB.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo Vídeo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingVideo ? 'Editar Vídeo' : 'Novo Vídeo'}</DialogTitle></DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const valid = await validateFormData();
                if (!valid) {
                  toast({ title: 'URLs inválidas', description: 'Corrija os campos marcados antes de salvar.', variant: 'destructive' });
                  return;
                }
                saveMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div>
                <Label>Vídeo *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.video_url}
                    onChange={(e) => {
                      setFormData({ ...formData, video_url: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, video_url: undefined }));
                    }}
                    placeholder="URL do vídeo ou upload"
                    required
                    aria-invalid={!!fieldErrors.video_url}
                  />
                  <label className="cursor-pointer">
                    <input type="file" accept="video/mp4,.mp4" className="hidden" onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
                    <Button type="button" variant="outline" asChild disabled={uploading}><span><Upload className="h-4 w-4 mr-1" />{uploading ? '...' : 'Upload'}</span></Button>
                  </label>
                </div>
                {fieldErrors.video_url && <p className="mt-1 text-xs text-destructive">{fieldErrors.video_url}</p>}
                {formData.video_url && (
                  <video src={normalizeMediaUrl(formData.video_url)} className="mt-2 w-full max-h-48 rounded object-cover" controls muted />
                )}
              </div>
              <div>
                <Label>Thumbnail (opcional)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.thumbnail_url}
                    onChange={(e) => {
                      setFormData({ ...formData, thumbnail_url: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, thumbnail_url: undefined }));
                    }}
                    placeholder="URL ou upload"
                    aria-invalid={!!fieldErrors.thumbnail_url}
                  />
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleThumbUpload(e.target.files[0])} />
                    <Button type="button" variant="outline" asChild disabled={uploadingThumb}><span><Upload className="h-4 w-4 mr-1" />{uploadingThumb ? '...' : 'Upload'}</span></Button>
                  </label>
                </div>
                {fieldErrors.thumbnail_url && <p className="mt-1 text-xs text-destructive">{fieldErrors.thumbnail_url}</p>}
              </div>
              <div><Label>Username Instagram</Label><Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="@usuario" className="mt-1" /></div>
              <div>
                <Label>Produto relacionado (opcional)</Label>
                <Select value={formData.product_handle || 'none'} onValueChange={(value) => setFormData({ ...formData, product_handle: value === 'none' ? '' : value })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(shopifyProducts ?? []).map(({ node }) => (
                      <SelectItem key={node.handle} value={node.handle}>{node.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Aparece abaixo do vídeo com link para a página do produto.</p>
              </div>
              <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} /><Label>Ativo</Label></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground py-4">Carregando...</p> : videos?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum vídeo cadastrado.</p>
      ) : (
        <div className="grid gap-3">
          {videos?.map((video) => (
            <Card key={video.id} className={video.is_active === false ? 'opacity-60' : ''}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-shrink-0 w-16 h-20 bg-muted rounded overflow-hidden">
                    {video.thumbnail_url && !failedListThumbIds[video.id] ? (
                      <img
                        src={normalizeMediaUrl(video.thumbnail_url)}
                        alt="Thumb"
                        className="w-full h-full object-cover"
                        onError={() => setFailedListThumbIds((prev) => ({ ...prev, [video.id]: true }))}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Video className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{video.username ? `@${video.username}` : 'Sem username'}</p>
                    <p className="text-xs text-muted-foreground truncate">{video.product_handle ? `Produto: ${productTitleByHandle.get(video.product_handle) ?? video.product_handle}` : video.video_url}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(video)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir vídeo?</AlertDialogTitle>
                          <AlertDialogDescription>O vídeo {video.username ? `de @${video.username}` : ''} será excluído permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(video.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Personalization() {
  const [searchParams] = useSearchParams();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold">Home Page</h1>
        <p className="text-sm text-muted-foreground">Organize as seções, o cabeçalho (menu de categorias), o rodapé e os vídeos da página inicial. Banners ficam no menu Banners.</p>
      </div>

      <Tabs defaultValue={searchParams.get('tab') ?? 'builder'} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="builder" className="flex items-center gap-2"><Layers className="h-4 w-4" />Construtor</TabsTrigger>
          <TabsTrigger value="header" className="flex items-center gap-2"><PanelTop className="h-4 w-4" />Cabeçalho e categorias</TabsTrigger>
          <TabsTrigger value="secoes" className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" />Seções Produtos</TabsTrigger>
          <TabsTrigger value="recursos" className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Recursos</TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2"><Video className="h-4 w-4" />Inspire-se</TabsTrigger>
          <TabsTrigger value="avaliacoes" className="flex items-center gap-2"><MessageSquareQuote className="h-4 w-4" />Avaliações</TabsTrigger>
          <TabsTrigger value="rodape" className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Rodapé</TabsTrigger>
        </TabsList>
        <TabsContent value="builder"><HomePageBuilder /></TabsContent>
        <TabsContent value="header"><HeaderCustomizer /></TabsContent>
        <TabsContent value="secoes"><HomeSectionsManager /></TabsContent>
        <TabsContent value="recursos"><FeaturesBarManager /></TabsContent>
        <TabsContent value="videos"><InstagramVideosSection /></TabsContent>
        <TabsContent value="avaliacoes"><TestimonialsManager /></TabsContent>
        <TabsContent value="rodape"><FooterCustomizer /></TabsContent>
      </Tabs>
    </div>
  );
}
