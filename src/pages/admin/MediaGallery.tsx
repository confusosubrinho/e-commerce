import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { compressImageToWebP } from '@/lib/imageCompressor';

export default function MediaGallery() {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: files = [], isLoading, error } = useQuery({
    queryKey: ['editorial-media'],
    queryFn: async () => {
      const result: { name: string; url: string }[] = [];
      const folders = [''];
      for (let i = 0; i < folders.length; i++) {
        for (let offset = 0; ; offset += 100) {
          const { data, error } = await supabase.storage.from('product-media').list(folders[i], { limit: 100, offset });
          if (error) throw error;
          for (const item of data ?? []) {
            const name = folders[i] ? folders[i] + '/' + item.name : item.name;
            if (!item.id) folders.push(name);
            else result.push({ name, url: supabase.storage.from('product-media').getPublicUrl(name).data.publicUrl });
          }
          if (!data || data.length < 100) break;
        }
      }
      return result;
    },
  });
  async function upload(selected: FileList | null) {
    if (!selected?.length) return;
    const entries = Array.from(selected);
    setBusy(true);
    try {
      for (const file of entries) {
        const prepared = file.type.startsWith('image/') ? await compressImageToWebP(file) : { file, fileName: 'editorial/' + crypto.randomUUID() + '-' + file.name };
        const { error } = await supabase.storage.from('product-media').upload(prepared.fileName, prepared.file);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ['editorial-media'] });
      toast({ title: 'Arquivos enviados' });
    } catch (error) {
      toast({ title: 'Erro ao enviar arquivos', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally { setBusy(false); }
  }
  async function remove(name: string) {
    if (!window.confirm('Excluir este arquivo? Conteúdos que utilizam esta mídia precisarão de outra imagem.')) return;
    const { error } = await supabase.storage.from('product-media').remove([name]);
    if (error) toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' });
    else await qc.invalidateQueries({ queryKey: ['editorial-media'] });
  }
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Galeria de mídia</h1>
    <p className="text-muted-foreground">Imagens e vídeos dos conteúdos do site.</p>
    <Input aria-label="Buscar arquivos" placeholder="Buscar arquivos" value={search} onChange={e => setSearch(e.target.value)} />
    <label className="block">{busy ? 'Enviando...' : 'Enviar arquivos'}<input type="file" accept="image/*,video/*" multiple disabled={busy} onChange={e => { void upload(e.target.files); e.target.value = ''; }} /></label>
    {isLoading && <p>Carregando...</p>}
    {error && <p role="alert">Não foi possível carregar a mídia.</p>}
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map(f => <div key={f.name} className="rounded-lg border p-3 space-y-2">
        {/\.(mp4|mov|webm)$/i.test(f.name) ? <video src={f.url} controls preload="none" className="aspect-square object-cover w-full" /> : <img src={f.url} alt={f.name} loading="lazy" className="aspect-square object-cover w-full" />}
        <p className="truncate text-sm" title={f.name}>{f.name}</p>
        <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(f.url).then(() => toast({ title: 'Link copiado' })).catch(() => toast({ title: 'Não foi possível copiar', variant: 'destructive' })); }}>Copiar link</Button>
        <Button variant="ghost" size="sm" onClick={() => void remove(f.name)}>Excluir</Button>
      </div>)}
    </div>
    {!isLoading && !error && !files.length && <p>Nenhum arquivo enviado.</p>}
  </div>;
}
