/**
 * The light piano's samples (ft_0_07.AC3): each recording cut to `LIGHT_SECONDS` with a fade over its last
 * `LIGHT_FADE_SECONDS`, and its channels mixed to one. A note held longer than that fades away sooner; laptop and tablet
 * speakers lose little by mono. Pure arithmetic on the decoded samples, so it is tested without a browser.
 */

/** How long a light sample lasts, in seconds. AX-3 provisional: long enough for a held whole note at a slow pace. */
export const LIGHT_SECONDS = 5;
/** How long its end fades out, in seconds. */
export const LIGHT_FADE_SECONDS = 1;

/** One channel: the average of `channels`, at most `seconds` long at `sampleRate`, faded to silence over its last `fade` seconds. */
export function lightChannel(channels: readonly Float32Array[], sampleRate: number, seconds = LIGHT_SECONDS, fade = LIGHT_FADE_SECONDS): Float32Array<ArrayBuffer> {
  const length = Math.min(channels[0]?.length ?? 0, Math.round(seconds * sampleRate));
  const out = new Float32Array(length);
  const fadeLength = Math.min(length, Math.round(fade * sampleRate));
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i]!;
    const left = length - i;
    out[i] = (sum / channels.length) * (left < fadeLength ? left / fadeLength : 1);
  }
  return out;
}

/** A decoded sample made light: a new one-channel buffer from `context`. */
export function lightBuffer(context: BaseAudioContext, buffer: AudioBuffer): AudioBuffer {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const mono = lightChannel(channels, buffer.sampleRate);
  const light = context.createBuffer(1, Math.max(1, mono.length), buffer.sampleRate);
  light.copyToChannel(mono, 0);
  return light;
}
