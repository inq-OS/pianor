/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' in a release build (`tools/release/pack.sh`): what only a developer uses is left out (ft_1_16.AC4). */
  readonly VITE_PIANOR_RELEASE?: string;
  /** '1' in the end-to-end tests' bundle (playwright.config.ts): their own pieces and songs come too. */
  readonly VITE_PIANOR_E2E?: string;
}
