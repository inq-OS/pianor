// Diagnostic (temporary): how the browser's audio clock runs on this machine compared with the wall clock.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto('about:blank');
const result = await page.evaluate(async () => {
  const ctx = new AudioContext();
  const state0 = ctx.state;
  await new Promise((r) => setTimeout(r, 300));
  const samples = [];
  const t0 = performance.now(), a0 = ctx.currentTime;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100));
    samples.push({ wall: Math.round(performance.now() - t0), audio: Math.round((ctx.currentTime - a0) * 1000) });
  }
  return { state0, state: ctx.state, sampleRate: ctx.sampleRate, baseLatency: ctx.baseLatency, outputLatency: ctx.outputLatency, samples };
});
console.log(JSON.stringify(result));
await browser.close();
