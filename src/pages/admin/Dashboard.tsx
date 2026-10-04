import { Link } from 'react-router-dom';
import { ExternalLink, Image, Palette, FileText, Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SHOPIFY_ADMIN_URL } from '@/lib/shopify/client';

const contentLinks = [
  { title: 'Aparência e vitrines', description: 'Organize a home e as vitrines da Shopify.', url: '/admin/personalizacao', icon: Palette },
  { title: 'Páginas', description: 'Edite o conteúdo institucional da loja.', url: '/admin/paginas', icon: FileText },
  { title: 'Galeria de mídia', description: 'Gerencie imagens e arquivos do site.', url: '/admin/galeria', icon: Image },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administração do site</h1>
        <p className="text-muted-foreground">Conteúdo, aparência e vitrines da loja.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Operação da loja</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Produtos, estoque, clientes e relatórios são gerenciados na Shopify.</p>
          <Button asChild><a href={SHOPIFY_ADMIN_URL} target="_blank" rel="noopener noreferrer">Abrir Shopify<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {contentLinks.map(({ title, description, url, icon: Icon }) => (
          <Card key={url}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5" />{title}</CardTitle></CardHeader>
            <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{description}</p><Button variant="outline" asChild><Link to={url}>Gerenciar</Link></Button></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
