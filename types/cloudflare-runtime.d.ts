/**
 * The browser app is type-checked without Cloudflare's deployment-only type
 * package. Vinext supplies the runtime bindings at deploy time; these minimal
 * declarations keep the application check portable for contributors and CI.
 */
interface D1Database {
  readonly __imagelabD1Brand?: never;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: { DB?: D1Database };
}
