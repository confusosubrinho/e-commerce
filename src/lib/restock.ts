import { z } from 'zod';

export function normalizeWhatsApp(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export const restockContactSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().trim().toLowerCase().email('Informe um email válido.').max(320),
  whatsapp: z.string().transform(normalizeWhatsApp).refine((value) => /^55[1-9]\d{9,10}$/.test(value), 'Informe o WhatsApp com DDD.'),
  consent: z.boolean().refine(Boolean, 'Autorize o contato para receber o aviso.'),
});

export function restockMessage(name: string, title: string, variant: string, handle: string) {
  return `Olá, ${name}! Você pediu um aviso da Vanessa Lima Shoes: ${title}${variant === 'Default Title' ? '' : ` (${variant})`} voltou ao estoque. Confira a disponibilidade e finalize sua compra: https://vanessalimashoes.com.br/produto/${handle}`;
}
