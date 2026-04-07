import { useState, useCallback, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
const HighlightBannersAdmin = lazy(() => import('./HighlightBanners'));
import { HomeSectionsManager } from '@/components/admin/HomeSectionsManager';
import { HomePageBuilder } from '@/components/admin/HomePageBuilder';
import { LayoutGrid, Tag, FileText, CreditCard, Sparkles, PanelTop, MessageSquareQuote, Layers } from 'lucide-react';
import { TestimonialsManager } from '@/components/admin/TestimonialsManager';
import { FeaturesBarManager } from '@/components/admin/FeaturesBarManager';
import { FooterCustomizer } from '@/components/admin/FooterCustomizer';
import { PagesEditor } from '@/components/admin/PagesEditor';
import { HeaderCustomizer } from '@/components/admin/HeaderCustomizer';
import { useDragReorder } from '@/hooks/useDragReorder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { compressImageToWebP } from '@/lib/imageCompressor';
import { Plus, Pencil, Trash2, GripVertical, Upload, Monitor, Smartphone, Video, Image as ImageIcon } from 'lucide-react';

// ─── Banners Section (reuse logic from Banners page) ───


interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  display_order: number;
  is_active: boolean;
}

function BannersSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Erro inesperado';
  };
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [uploading, setUploading] = useState<'desktop' | 'mobile' | null>(null);
  const [formData, setFormData] = useState({
    title: '', subtitle: '', image_url: '', mobile_image_url: '', cta_text: '', cta_url: '', is_active: true,
  });

  const { data: banners, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('banners').select('*').order('display_order', { ascending: true });
      if (error) throw error;
      return data as Banner[];
    },
  });

  const handleFileUpload = useCallback(async (file: File, type: 'desktop' | 'mobile') => {
    setUploading(type);
    try {
      const { file: compressedFile, fileName } = await compressImageToWebP(file);
      const { error: uploadError } = await supabase.storage.from('product-media').upload(fileName, compressedFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-media').getPublicUrl(fileName);
      if (type === 'desktop') setFormData(prev => ({ ...prev, image_url: publicUrl }));
      else setFormData(prev => ({ ...prev, mobile_image_url: publicUrl }));
      toast({ title: 'Imagem enviada!' });
    } catch (error: unknown) {
      toast({ title: 'Erro ao enviar', description: getErrorMessage(error), variant: 'destructive' });
    } finally { setUploading(null); }
  }, [toast]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const bannerData = {
        title: data.title || null, subtitle: data.subtitle || null,
        image_url: data.image_url, mobile_image_url: data.mobile_image_url || null,
        cta_text: data.cta_text || null, cta_url: data.cta_url || null,
        is_active: data.is_active, display_order: editingBanner?.display_order || (banners?.length || 0),
      };
      if (editingBanner) {
        const { error } = await supabase.from('banners').update(bannerData).eq('id', editingBanner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('banners').insert(bannerData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setIsDialogOpen(false); resetForm();
      toast({ title: editingBanner ? 'Banner atualizado!' : 'Banner criado!' });
    },
    onError: (error: unknown) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      toast({ title: 'Banner excluído!' });
    },
  });

  const resetForm = () => {
    setFormData({ title: '', subtitle: '', image_url: '', mobile_image_url: '', cta_text: '', cta_url: '', is_active: true });
    setEditingBanner(null);
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '', subtitle: banner.subtitle || '',
      image_url: banner.image_url, mobile_image_url: banner.mobile_image_url || '',
      cta_text: banner.cta_text || '', cta_url: banner.cta_url || '', is_active: banner.is_active,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Banners da Página Inicial</h3>
          <p className="text-sm text-muted-foreground">Carrossel principal do topo da loja</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo Banner</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>{editingBanner ? 'Editar Banner' : 'Novo Banner'}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
              <Tabs defaultValue="desktop">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="desktop"><Monitor className="h-4 w-4 mr-1" />Desktop</TabsTrigger>
                  <TabsTrigger value="mobile"><Smartphone className="h-4 w-4 mr-1" />Mobile</TabsTrigger>
                </TabsList>
                <TabsContent value="desktop" className="space-y-3 mt-3">
                  <Label>Imagem Desktop (1920x600) *</Label>
                  <div className="flex gap-2">
                    <Input value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} placeholder="URL ou upload" required />
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'desktop')} />
                      <Button type="button" variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" />{uploading === 'desktop' ? '...' : 'Upload'}</span></Button>
                    </label>
                  </div>
                  {formData.image_url && <AspectRatio ratio={16/5} className="bg-muted rounded-lg overflow-hidden"><img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" /></AspectRatio>}
                </TabsContent>
                <TabsContent value="mobile" className="space-y-3 mt-3">
                  <Label>Imagem Mobile (750x900)</Label>
                  <div className="flex gap-2">
                    <Input value={formData.mobile_image_url} onChange={(e) => setFormData({ ...formData, mobile_image_url: e.target.value })} placeholder="URL ou upload" />
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'mobile')} />
                      <Button type="button" variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" />{uploading === 'mobile' ? '...' : 'Upload'}</span></Button>
                    </label>
                  </div>
                  {formData.mobile_image_url && <div className="max-w-[200px] mx-auto"><AspectRatio ratio={9/16} className="bg-muted rounded-lg overflow-hidden"><img src={formData.mobile_image_url} alt="Preview Mobile" className="w-full h-full object-cover" /></AspectRatio></div>}
                </TabsContent>
              </Tabs>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Título</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
                <div><Label>Subtítulo</Label><Input value={formData.subtitle} onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Texto do Botão</Label><Input value={formData.cta_text} onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })} placeholder="Ver ofertas" /></div>
                <div><Label>Link do Botão</Label><Input value={formData.cta_url} onChange={(e) => setFormData({ ...formData, cta_url: e.target.value })} placeholder="/outlet" /></div>
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

      {isLoading ? <p className="text-sm text-muted-foreground py-4">Carregando...</p> : banners?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum banner cadastrado.</p>
      ) : (
        <div className="grid gap-3">
          {banners?.map((banner) => (
            <Card key={banner.id} className={!banner.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex gap-2 flex-shrink-0">
                    <img src={banner.image_url} alt={banner.title || 'Banner'} className="h-16 w-28 object-cover rounded" />
                    {banner.mobile_image_url && <img src={banner.mobile_image_url} alt="Mobile" className="h-16 w-10 object-cover rounded" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{banner.title || 'Sem título'}</p>
                    {banner.cta_url && <p className="text-xs text-primary truncate">{banner.cta_url}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(banner)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir banner?</AlertDialogTitle>
                          <AlertDialogDescription>O banner "{banner.title || 'Sem título'}" será excluído permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(banner.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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

// ─── Instagram Videos Section ───

interface InstagramVideo {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  username: string | null;
  product_id: string | null;
  display_order: number | null;
  is_active: boolean | null;
}

interface ProductOption {
  id: string;
  name: string;
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
    video_url: '', thumbnail_url: '', username: '', product_id: '', is_active: true,
  });

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Erro inesperado';
  };

  const normalizeMediaUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    try {
      const u = new URL(trimmed);
      if (u.pathname.includes('/storage/v1/object/sign/')) {
        u.pathname = u.pathname.replace('/storage/v1/object/sign/', '/storage/v1/object/public/');
        u.search = '';
      }
      return encodeURI(u.toString());
    } catch {
      return encodeURI(trimmed);
    }
  };

  const isLikelyIncompatibleVideoUrl = (value: string): boolean => {
    const normalized = normalizeMediaUrl(value).toLowerCase();
    if (!normalized) return false;
    return normalized.includes('.webm');
  };

  const isSupportedVideoUpload = (file: File): boolean => {
    const lowerName = file.name.toLowerCase();
    const mime = file.type.toLowerCase();
    const byExt = lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.m4v');
    const byMime = mime === 'video/mp4' || mime === 'video/quicktime' || mime === 'video/x-m4v';
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

  const { data: products } = useQuery({
    queryKey: ['admin-products-simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data as ProductOption[];
    },
  });

  const handleVideoUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      if (!isSupportedVideoUpload(file)) {
        toast({
          title: 'Formato não suportado',
          description: 'Use vídeo em MP4/MOV (recomendado: MP4 H.264).',
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
        product_id: string | null;
        is_active: boolean;
        display_order: number | null;
      } = {
        video_url: normalizedVideoUrl,
        thumbnail_url: normalizedThumbUrl || null,
        username: data.username || null,
        product_id: data.product_id || null,
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
    setFormData({ video_url: '', thumbnail_url: '', username: '', product_id: '', is_active: true });
    setFieldErrors({});
    setEditingVideo(null);
  };

  const handleEdit = (video: InstagramVideo) => {
    setEditingVideo(video);
    setFormData({
      video_url: video.video_url, thumbnail_url: video.thumbnail_url || '',
      username: video.username || '', product_id: video.product_id || '', is_active: video.is_active !== false,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vídeos Inspire-se</h3>
          <p className="text-sm text-muted-foreground">Vídeos exibidos na seção "Inspire-se" da home. Máx. 10MB por vídeo.</p>
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
                    <input type="file" accept="video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v" className="hidden" onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
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
                <Label>Produto Vinculado</Label>
                <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar produto..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                    <p className="text-xs text-muted-foreground truncate">{video.video_url}</p>
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

// ─── Categories Order Section ───

function CategoriesOrderSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Erro inesperado';
  };

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories-order'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, image_url, is_active, display_order, parent_category_id')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        id: string; name: string; slug: string; image_url: string | null;
        is_active: boolean; display_order: number; parent_category_id: string | null;
      }>;
    },
  });

  // Only show root categories (no parent) for home ordering
  const rootCategories = categories?.filter(c => !c.parent_category_id) || [];

  const reorderMutation = useMutation({
    mutationFn: async (reordered: typeof rootCategories) => {
      const updates = reordered.map((c, i) =>
        supabase.from('categories').update({ display_order: i }).eq('id', c.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories-order'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Ordem salva!' });
    },
    onError: (error: unknown) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const { getDragProps } = useDragReorder({
    items: rootCategories,
    onReorder: (reordered) => {
      // Update cache optimistically
      queryClient.setQueryData(['admin-categories-order'], (old: unknown) => {
        if (!old) return reordered;
        const oldCategories = Array.isArray(old)
          ? old as Array<{ parent_category_id: string | null }>
          : [];
        const childCategories = oldCategories.filter((c) => c.parent_category_id);
        return [...reordered, ...childCategories];
      });
      reorderMutation.mutate(reordered);
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories-order'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: unknown) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Categorias da Home</h3>
        <p className="text-sm text-muted-foreground">Arraste para reordenar. Desative categorias que não quer exibir na home.</p>
      </div>

      {rootCategories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nenhuma categoria cadastrada.</p>
            <p className="text-xs mt-1">Crie categorias na página de Categorias primeiro.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {rootCategories.map((cat, index) => {
            const childCount = categories?.filter(c => c.parent_category_id === cat.id).length || 0;
            return (
              <Card
                key={cat.id}
                className={`transition-opacity ${!cat.is_active ? 'opacity-40' : ''}`}
                {...getDragProps(index)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={cat.image_url || '/placeholder.svg'}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">/{cat.slug}{childCount > 0 ? ` · ${childCount} sub` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={cat.is_active}
                          onCheckedChange={(checked) => toggleVisibility.mutate({ id: cat.id, is_active: checked })}
                          className="scale-90"
                        />
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {cat.is_active ? 'Visível' : 'Oculta'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Apenas categorias raiz são exibidas na home. Subcategorias aparecem dentro das páginas de categoria.
      </p>
    </div>
  );
}

// ─── Main Page ───

export default function Personalization() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold">Personalização</h1>
        <p className="text-sm text-muted-foreground">Gerencie banners, destaques, categorias e vídeos da página inicial</p>
      </div>

      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="builder" className="flex items-center gap-2"><Layers className="h-4 w-4" />Construtor</TabsTrigger>
          <TabsTrigger value="header" className="flex items-center gap-2"><PanelTop className="h-4 w-4" />Header</TabsTrigger>
          <TabsTrigger value="secoes" className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" />Seções Produtos</TabsTrigger>
          <TabsTrigger value="recursos" className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Recursos</TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center gap-2"><Tag className="h-4 w-4" />Categorias</TabsTrigger>
          <TabsTrigger value="banners" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />Banners</TabsTrigger>
          <TabsTrigger value="destaques" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />Destaques</TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2"><Video className="h-4 w-4" />Inspire-se</TabsTrigger>
          <TabsTrigger value="avaliacoes" className="flex items-center gap-2"><MessageSquareQuote className="h-4 w-4" />Avaliações</TabsTrigger>
          <TabsTrigger value="rodape" className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Rodapé</TabsTrigger>
          <TabsTrigger value="paginas" className="flex items-center gap-2"><FileText className="h-4 w-4" />Páginas</TabsTrigger>
        </TabsList>
        <TabsContent value="builder"><HomePageBuilder /></TabsContent>
        <TabsContent value="header"><HeaderCustomizer /></TabsContent>
        <TabsContent value="secoes"><HomeSectionsManager /></TabsContent>
        <TabsContent value="recursos"><FeaturesBarManager /></TabsContent>
        <TabsContent value="categorias"><CategoriesOrderSection /></TabsContent>
        <TabsContent value="banners"><BannersSection /></TabsContent>
        <TabsContent value="destaques">
          <Suspense fallback={<p className="text-sm text-muted-foreground py-4">Carregando...</p>}>
            <HighlightBannersAdmin />
          </Suspense>
        </TabsContent>
        <TabsContent value="videos"><InstagramVideosSection /></TabsContent>
        <TabsContent value="avaliacoes"><TestimonialsManager /></TabsContent>
        <TabsContent value="rodape"><FooterCustomizer /></TabsContent>
        <TabsContent value="paginas"><PagesEditor /></TabsContent>
      </Tabs>
    </div>
  );
}
