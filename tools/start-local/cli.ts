import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { preview } from 'vite';
import { appWindowArgs, browserCandidates, isPath, profileDir } from './browser.ts';

// `npm run start:local` (ft_0_14, d068, d105): after `vite build`, serve the build on 127.0.0.1:4173 and open it as Pianor's own
// window: Edge (or Chrome) in app mode, full screen, with a browser profile of its own. Stop it with Ctrl+C.
const HOST = '127.0.0.1';
const PORT = 4173;
const url = `http://${HOST}:${PORT}/`;

const server = await preview({ preview: { host: HOST, port: PORT, strictPort: true, open: false } });
server.printUrls();

const profile = profileDir(process.platform, process.env, homedir());

/** Start the first candidate that runs. */
function openBrowser(candidates: string[]): void {
  const [next, ...rest] = candidates;
  if (next === undefined) {
    console.log(`No Edge or Chrome found: open ${url} in one and press F11.`);
    return;
  }
  if (isPath(next) && !existsSync(next)) return openBrowser(rest);
  const child = spawn(next, appWindowArgs(url, profile), { detached: true, stdio: 'ignore' });
  child.on('error', () => openBrowser(rest));
  child.on('spawn', () => {
    console.log(`Opened ${url} as its own window (browser profile: ${profile}).`);
    child.unref();
  });
}

openBrowser(browserCandidates(process.platform, process.env));
