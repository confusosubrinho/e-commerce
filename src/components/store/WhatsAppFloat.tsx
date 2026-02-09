import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const WHATSAPP_NUMBER = '5542991120205';

function getMessageForRoute(pathname: string): string {
  if (pathname.startsWith('/produto/')) {
    const slug = pathname.replace('/produto/', '');
    return `Olá! Estou vendo o produto ${slug} no site e gostaria de mais informações.`;
  }
  if (pathname === '/carrinho' || pathname === '/checkout') {
    return 'Olá! Estou finalizando uma compra e preciso de ajuda.';
  }
  if (pathname.startsWith('/categoria/')) {
    const cat = pathname.replace('/categoria/', '');
    return `Olá! Estou navegando na categoria ${cat} e gostaria de ajuda para escolher.`;
  }
  if (pathname === '/bijuterias') {
    return 'Olá! Estou olhando as bijuterias e gostaria de saber mais!';
  }
  if (pathname === '/mais-vendidos') {
    return 'Olá! Vi os mais vendidos e gostaria de saber mais sobre os produtos.';
  }
  if (pathname === '/faq') {
    return 'Olá! Não encontrei a resposta que procurava no FAQ. Pode me ajudar?';
  }
  if (pathname === '/rastreio') {
    return 'Olá! Gostaria de rastrear meu pedido.';
  }
  if (pathname === '/trocas') {
    return 'Olá! Gostaria de fazer uma troca ou devolução.';
  }
  return 'Olá! Estou visitando o site da Vanessa Lima Shoes e gostaria de mais informações.';
}

export function WhatsAppFloat() {
  const location = useLocation();
  
  // Don't show on admin pages or checkout
  if (location.pathname.startsWith('/admin') || location.pathname === '/checkout') return null;

  const message = getMessageForRoute(location.pathname);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 group"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
      <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-background text-foreground text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border">
        Fale conosco!
      </span>
    </a>
  );
}
