// Voice input with the browser's Web Speech API (Chrome, Edge, Safari; not Firefox).
// What you say lands in the speech box, and goes through the same send path (and the same
// era-voice rewrite) as typing. Plain functions here, so tests can drive them with a fake.

/** The browser's speech recognition class, or null where it is not supported. */
export function speechRecognitionCtor(win = globalThis.window) {
  return win?.SpeechRecognition ?? win?.webkitSpeechRecognition ?? null;
}

/** Everything heard so far in one session (final and interim results), as one line. */
export function transcriptOf(results) {
  let text = '';
  for (let i = 0; i < results.length; i++) text += ` ${results[i][0]?.transcript ?? ''}`;
  return text.replace(/\s+/g, ' ').trim();
}

const ERRORS = {
  'no-speech': 'No speech heard — try again.',
  'audio-capture': 'No microphone found.',
  'not-allowed': 'The microphone is blocked — allow it in your browser to speak.',
  'service-not-allowed': 'The microphone is blocked — allow it in your browser to speak.',
  network: 'Voice input needs an internet connection.',
};

/** A message for a recognition error code, or null when there is nothing to report. */
export function speechErrorMessage(code) {
  if (code === 'aborted') return null; // we stopped it
  return ERRORS[code] ?? 'Voice input stopped working — please type instead.';
}

/**
 * Starts one recognition session (it ends by itself after a pause in speech).
 * @param {new () => any} Recognition  from speechRecognitionCtor()
 * @param {{lang?: string, onText: (text: string) => void, onError: (message: string) => void,
 *          onEnd: () => void}} handlers
 * @returns the session, with stop() and abort()
 */
export function startListening(Recognition, { lang = 'en-US', onText, onError, onEnd }) {
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = true; // show words as they are heard
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => onText(transcriptOf(event.results));
  recognition.onerror = (event) => {
    const message = speechErrorMessage(event.error);
    if (message) onError(message);
  };
  recognition.onend = () => onEnd();
  recognition.start();
  return recognition;
}
