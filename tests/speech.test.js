// M5: voice input — the Web Speech API wiring, driven by a fake recognizer (no browser needed).

import { describe, expect, it, vi } from 'vitest';
import {
  speechErrorMessage,
  speechRecognitionCtor,
  startListening,
  transcriptOf,
} from '../src/lib/speech.js';

class FakeRecognition {
  static last = null;
  constructor() {
    FakeRecognition.last = this;
    this.started = false;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
}

/** A SpeechRecognitionResultList-like value: [[{ transcript }], ...]. */
const results = (...parts) => parts.map((transcript) => [{ transcript }]);

describe('voice input', () => {
  it('finds the recognizer where the browser has one (standard name first)', () => {
    const standard = function SpeechRecognition() {};
    const webkit = function webkitSpeechRecognition() {};
    expect(speechRecognitionCtor({})).toBeNull(); // e.g. Firefox: no "Speak" button
    expect(speechRecognitionCtor(undefined)).toBeNull(); // no window at all (server, tests)
    expect(speechRecognitionCtor({ webkitSpeechRecognition: webkit })).toBe(webkit); // Safari
    expect(
      speechRecognitionCtor({ SpeechRecognition: standard, webkitSpeechRecognition: webkit }),
    ).toBe(standard);
  });

  it('joins what was heard so far into one line', () => {
    expect(transcriptOf(results('Caesar ', ' stay home', 'today'))).toBe('Caesar stay home today');
    expect(transcriptOf(results())).toBe('');
  });

  it('streams words into the box, reports real errors, and ends', () => {
    const onText = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();
    const session = startListening(FakeRecognition, { onText, onError, onEnd });
    const rec = FakeRecognition.last;
    expect(session).toBe(rec);
    expect(rec).toMatchObject({ started: true, lang: 'en-US', interimResults: true });

    rec.onresult({ results: results('Brutus,') });
    rec.onresult({ results: results('Brutus,', ' why so pale?') });
    expect(onText).toHaveBeenLastCalledWith('Brutus, why so pale?');

    rec.onerror({ error: 'aborted' }); // we stopped it: nothing to report
    expect(onError).not.toHaveBeenCalled();
    rec.onerror({ error: 'not-allowed' });
    expect(onError).toHaveBeenCalledWith(speechErrorMessage('not-allowed'));

    session.stop();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('explains the common errors in plain words', () => {
    expect(speechErrorMessage('not-allowed')).toMatch(/microphone is blocked/);
    expect(speechErrorMessage('no-speech')).toMatch(/No speech heard/);
    expect(speechErrorMessage('something-new')).toMatch(/please type instead/);
    expect(speechErrorMessage('aborted')).toBeNull();
  });
});
