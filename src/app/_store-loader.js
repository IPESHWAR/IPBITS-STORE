'use client';

import StorePage from './_store-page';

/**
 * Client entry for the storefront. Keeps the page shell as a Server Component
 * while rendering the interactive store only on the client.
 */
export default function StoreLoader() {
  return <StorePage />;
}
