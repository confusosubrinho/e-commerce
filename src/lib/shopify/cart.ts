import { storefrontApiRequest } from './client';
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
} from './queries';

interface UserError {
  field: string[] | null;
  message: string;
}

function isCartNotFoundError(userErrors: UserError[]): boolean {
  return userErrors.some(
    (e) =>
      e.message.toLowerCase().includes('cart not found') ||
      e.message.toLowerCase().includes('does not exist')
  );
}

/** Garante que o checkoutUrl tenha channel=online_store para evitar tela de senha. */
export function formatCheckoutUrl(checkoutUrl: string): string {
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set('channel', 'online_store');
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

interface CartCreateResult {
  cartId: string;
  checkoutUrl: string;
  lineId: string;
}

interface CartMutationResult {
  success: boolean;
  lineId?: string;
  cartNotFound?: boolean;
}

interface CreateLine {
  variantId: string;
  quantity: number;
}

export async function createShopifyCart(line: CreateLine): Promise<CartCreateResult | null> {
  const data = await storefrontApiRequest<{
    cartCreate: {
      cart: {
        id: string;
        checkoutUrl: string;
        lines: { edges: Array<{ node: { id: string } }> };
      } | null;
      userErrors: UserError[];
    };
  }>(CART_CREATE_MUTATION, {
    input: { lines: [{ quantity: line.quantity, merchandiseId: line.variantId }] },
  });

  if (!data) return null;
  const userErrors = data.data?.cartCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    console.error('Shopify cartCreate errors:', userErrors);
    return null;
  }
  const cart = data.data?.cartCreate?.cart;
  if (!cart?.checkoutUrl) return null;
  const lineId = cart.lines.edges[0]?.node?.id;
  if (!lineId) return null;
  return { cartId: cart.id, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl), lineId };
}

export async function addLineToShopifyCart(
  cartId: string,
  line: CreateLine
): Promise<CartMutationResult> {
  const data = await storefrontApiRequest<{
    cartLinesAdd: {
      cart: { lines: { edges: Array<{ node: { id: string; merchandise: { id: string } } }> } } | null;
      userErrors: UserError[];
    };
  }>(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [{ quantity: line.quantity, merchandiseId: line.variantId }],
  });

  if (!data) return { success: false };
  const userErrors = data.data?.cartLinesAdd?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) {
    console.error('Shopify cartLinesAdd errors:', userErrors);
    return { success: false };
  }
  const lines = data.data?.cartLinesAdd?.cart?.lines?.edges ?? [];
  const newLine = lines.find((l) => l.node.merchandise.id === line.variantId);
  return { success: true, lineId: newLine?.node?.id };
}

export async function updateShopifyCartLine(
  cartId: string,
  lineId: string,
  quantity: number
): Promise<CartMutationResult> {
  const data = await storefrontApiRequest<{
    cartLinesUpdate: { userErrors: UserError[] };
  }>(CART_LINES_UPDATE_MUTATION, {
    cartId,
    lines: [{ id: lineId, quantity }],
  });
  if (!data) return { success: false };
  const userErrors = data.data?.cartLinesUpdate?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) {
    console.error('Shopify cartLinesUpdate errors:', userErrors);
    return { success: false };
  }
  return { success: true };
}

export async function removeLineFromShopifyCart(
  cartId: string,
  lineId: string
): Promise<CartMutationResult> {
  const data = await storefrontApiRequest<{
    cartLinesRemove: { userErrors: UserError[] };
  }>(CART_LINES_REMOVE_MUTATION, {
    cartId,
    lineIds: [lineId],
  });
  if (!data) return { success: false };
  const userErrors = data.data?.cartLinesRemove?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) {
    console.error('Shopify cartLinesRemove errors:', userErrors);
    return { success: false };
  }
  return { success: true };
}
