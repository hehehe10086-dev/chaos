// React wrapper around src/lib/speech.js: one recognition session at a time.

import { useCallback, useEffect, useRef, useState } from 'react';
import { speechErrorMessage, speechRecognitionCtor, startListening } from '../lib/speech.js';

/**
 * @param {(text: string) => void} onText  called with everything heard so far, as it comes in
 */
export function useSpeechInput(onText) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const session = useRef(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });
  useEffect(() => () => session.current?.abort(), []); // leaving the page stops listening

  const start = useCallback(() => {
    const Recognition = speechRecognitionCtor();
    if (!Recognition || session.current) return;
    setError(null);
    try {
      session.current = startListening(Recognition, {
        onText: (text) => onTextRef.current(text),
        onError: setError,
        onEnd: () => {
          session.current = null;
          setListening(false);
        },
      });
      setListening(true);
    } catch {
      session.current = null;
      setError(speechErrorMessage('start'));
    }
  }, []);

  const stop = useCallback(() => session.current?.stop(), []);
  const clearError = useCallback(() => setError(null), []);

  return { supported: Boolean(speechRecognitionCtor()), listening, error, start, stop, clearError };
}
