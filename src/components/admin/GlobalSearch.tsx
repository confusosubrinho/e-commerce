import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Palette, FileText, Image, Settings, ExternalLink } from 'lucide-react';
import { SHOPIFY_ADMIN_URL } from '@/lib/shopify/client';

const shortcuts = [
  { title: 'Home e vitrines', url: '/admin/personalizacao', icon: Palette },
  { title: 'Tema visual', url: '/admin/tema', icon: Palette },
  { title: 'Páginas institucionais', url: '/admin/paginas', icon: FileText },
  { title: 'Blog', url: '/admin/blog', icon: FileText },
  { title: 'Galeria de mídia', url: '/admin/galeria', icon: Image },
  { title: 'Configurações do site', url: '/admin/configuracoes', icon: Settings },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen(value => !value);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas e configurações..." />
      <CommandList>
        <CommandEmpty>Nenhum atalho encontrado.</CommandEmpty>
        <CommandGroup heading="Site">
          {shortcuts.map(({ title, url, icon: Icon }) => (
            <CommandItem key={url} onSelect={() => { setOpen(false); navigate(url); }}><Icon className="mr-2 h-4 w-4" />{title}</CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Operação da loja">
          <CommandItem onSelect={() => { setOpen(false); window.open(SHOPIFY_ADMIN_URL, '_blank', 'noopener,noreferrer'); }}><ExternalLink className="mr-2 h-4 w-4" />Abrir Shopify</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
