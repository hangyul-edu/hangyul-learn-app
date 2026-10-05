/**
 * Playing a sentence's audio after fetching its URL, in a way iOS allows.
 *
 * WebKit only lets a page start audio from inside the user's tap. Our audio
 * URL arrives after an `await` (and, the first time a sentence is played, after
 * the server generates the speech, which takes a few seconds), by which time
 * the tap has expired and `play()` is refused with `NotAllowedError`.
 *
 * So the element is created and started inside the tap — on a moment of
 * silence — which marks it as allowed; the real URL is then swapped in and
 * played on that same element.
 */

/** A tiny silent WAV (8 kHz mono, one sample) as a data URL. */
function silentWav(): string {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 38, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 16000, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, 2, true); // one 16-bit sample of silence
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

let silence: string | null = null;

/**
 * Call synchronously in the tap handler, before any `await`. Returns an
 * element that may play later, after the URL has been fetched.
 */
export function unlockedAudio(): HTMLAudioElement {
  const audio = new Audio();
  silence ??= silentWav();
  audio.src = silence;
  try {
    const started = audio.play();
    // Rejection here is harmless: the element is still unlocked on iOS, and
    // browsers without the restriction do not need it.
    if (started && typeof started.catch === "function") started.catch(() => {});
  } catch {
    // jsdom and old browsers: nothing to unlock.
  }
  return audio;
}

/** Play `url` on an element from {@link unlockedAudio}. */
export async function playOn(audio: HTMLAudioElement, url: string): Promise<void> {
  audio.pause();
  audio.src = url;
  await audio.play();
}
