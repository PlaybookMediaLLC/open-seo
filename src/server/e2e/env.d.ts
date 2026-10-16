// Merges into ImportMetaEnv from src/env.d.ts, so the fork's E2E flag needs no
// line in that upstream file.
interface ImportMetaEnv {
  readonly VITE_E2E_GROWTH_FIXTURES?: string;
}
