/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' in a release build (`tools/release/pack.sh`): what only a developer uses is left out (ft_1_16.AC4). */
  readonly VITE_PIANOR_RELEASE?: string;
}
