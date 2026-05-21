import assert from "node:assert/strict";
import test from "node:test";

import {
  createGoogleTtsUrl,
  getSpeechSynthesisLanguage,
  playPronunciation,
} from "../js/tts.js";

test("creates an English Google Translate TTS URL", () => {
  assert.equal(
    createGoogleTtsUrl("hello", "en"),
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=hello",
  );
});

test("creates a Swedish Google Translate TTS URL", () => {
  assert.equal(
    createGoogleTtsUrl("hej", "sv"),
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=sv&q=hej",
  );
});

test("encodes phrases and non-ascii characters for Google Translate TTS", () => {
  assert.equal(
    createGoogleTtsUrl("god morgon åäö", "sv"),
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=sv&q=god%20morgon%20%C3%A5%C3%A4%C3%B6",
  );
});

test("maps app language codes to speech synthesis locales", () => {
  assert.equal(getSpeechSynthesisLanguage("en"), "en-US");
  assert.equal(getSpeechSynthesisLanguage("sv"), "sv-SE");
});

test("uses Google TTS audio when playback succeeds", async () => {
  const playedUrls = [];
  const spoken = [];

  class FakeAudio {
    constructor(url) {
      this.url = url;
      playedUrls.push(url);
    }

    play() {
      return Promise.resolve();
    }
  }

  await playPronunciation("hej", "sv", {
    AudioCtor: FakeAudio,
    speechSynthesis: { speak: (utterance) => spoken.push(utterance) },
    SpeechSynthesisUtteranceCtor: class FakeUtterance {},
  });

  assert.deepEqual(playedUrls, [
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=sv&q=hej",
  ]);
  assert.deepEqual(spoken, []);
});

test("falls back to speech synthesis when Google TTS audio playback fails", async () => {
  const spoken = [];

  class FakeAudio {
    play() {
      return Promise.reject(new Error("audio blocked"));
    }
  }

  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }

  await playPronunciation("hej", "sv", {
    AudioCtor: FakeAudio,
    speechSynthesis: { speak: (utterance) => spoken.push(utterance) },
    SpeechSynthesisUtteranceCtor: FakeUtterance,
    logWarning: () => {},
  });

  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, "hej");
  assert.equal(spoken[0].lang, "sv-SE");
});
