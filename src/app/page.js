import StoreLoader from './_store-loader';

// Server Component — delegates rendering to the client-only StoreLoader,
// which uses dynamic(ssr:false) to skip SSR and eliminate hydration mismatches.
export default function Page() {
  return <StoreLoader />;
}
