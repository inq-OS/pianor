import { createConfig } from './config';

/** The one config instance for this page load. */
export const appConfig = createConfig(window.location.search, import.meta.env.DEV, import.meta.env.MODE);
