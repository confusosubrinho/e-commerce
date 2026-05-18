// GraphQL queries & mutations para o Storefront API (versão 2025-07).

export const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query, sortKey: BEST_SELLING) {
      edges {
        node {
          id
          title
          description
          handle
          vendor
          productType
          tags
          availableForSale
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          compareAtPriceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          images(first: 5) {
            edges { node { url altText } }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                availableForSale
                quantityAvailable
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                selectedOptions { name value }
                image { url altText }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      descriptionHtml
      handle
      vendor
      productType
      tags
      availableForSale
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      compareAtPriceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      images(first: 10) {
        edges { node { url altText } }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            availableForSale
            quantityAvailable
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
            selectedOptions { name value }
            image { url altText }
          }
        }
      }
      options { name values }
    }
  }
`;

export const COLLECTIONS_WITH_PRODUCTS_QUERY = `
  query GetCollectionsWithProducts($first: Int!, $productsPerCollection: Int!) {
    collections(first: $first, sortKey: TITLE) {
      edges {
        node {
          id
          handle
          title
          description
          image { url altText }
          products(first: $productsPerCollection, sortKey: BEST_SELLING) {
            edges {
              node {
                id
                title
                handle
                priceRange { minVariantPrice { amount currencyCode } }
                images(first: 1) { edges { node { url altText } } }
              }
            }
          }
        }
      }
    }
  }
`;

export const COLLECTION_BY_HANDLE_QUERY = `
  query GetCollectionByHandle($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText }
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            description
            handle
            vendor
            productType
            tags
            availableForSale
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            images(first: 5) { edges { node { url altText } } }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  quantityAvailable
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                  selectedOptions { name value }
                  image { url altText }
                }
              }
            }
            options { name values }
          }
        }
      }
    }
  }
`;

export const CART_QUERY = `
  query Cart($id: ID!) {
    cart(id: $id) {
      id
      totalQuantity
      checkoutUrl
    }
  }
`;

export const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 100) {
          edges { node { id merchandise { ... on ProductVariant { id } } } }
        }
      }
      userErrors { field message }
    }
  }
`;

export const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 100) {
          edges { node { id merchandise { ... on ProductVariant { id } } } }
        }
      }
      userErrors { field message }
    }
  }
`;

export const CART_LINES_UPDATE_MUTATION = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id }
      userErrors { field message }
    }
  }
`;

export const CART_LINES_REMOVE_MUTATION = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id }
      userErrors { field message }
    }
  }
`;
