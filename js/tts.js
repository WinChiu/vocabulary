export const getSpeechSynthesisLanguage = (languageCode) => {
  const locales = {
    en: 'en-US',
    sv: 'sv-SE',
  };

  return locales[languageCode] || languageCode;
};

export const createGoogleTtsUrl = (text, languageCode) => {
  const cleanText = String(text || '').trim();

  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
    languageCode,
  )}&q=${encodeURIComponent(cleanText)}`;
};

const isMobileBrowser = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const waitForVoices = (speechSynthesis, timeout = 800) =>
  new Promise((resolve) => {
    if (!speechSynthesis || typeof speechSynthesis.getVoices !== 'function') {
      resolve([]);
      return;
    }

    const existingVoices = speechSynthesis.getVoices();

    if (existingVoices.length > 0) {
      resolve(existingVoices);
      return;
    }

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      speechSynthesis.removeEventListener?.('voiceschanged', finish);
      resolve(speechSynthesis.getVoices());
    };

    speechSynthesis.addEventListener?.('voiceschanged', finish, { once: true });

    setTimeout(finish, timeout);
  });

const findVoice = (voices, languageCode) => {
  const language = getSpeechSynthesisLanguage(languageCode);

  return (
    voices.find((voice) => voice.lang === language) ||
    voices.find((voice) => voice.lang?.startsWith(languageCode)) ||
    voices.find((voice) => voice.lang?.startsWith(language.split('-')[0])) ||
    null
  );
};

const playWithSpeechSynthesis = async (
  cleanText,
  languageCode,
  dependencies = {},
) => {
  const speechSynthesis =
    dependencies.speechSynthesis || globalThis.speechSynthesis;

  const SpeechSynthesisUtteranceCtor =
    dependencies.SpeechSynthesisUtteranceCtor ||
    globalThis.SpeechSynthesisUtterance;

  const logWarning = dependencies.logWarning || console.warn;

  if (!speechSynthesis || !SpeechSynthesisUtteranceCtor) {
    return false;
  }

  const lang = getSpeechSynthesisLanguage(languageCode);
  const voices = await waitForVoices(speechSynthesis);
  const voice = findVoice(voices, languageCode);

  if (!voice) {
    logWarning(`No speech synthesis voice found for ${lang}.`);
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtteranceCtor(cleanText);

    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    if (voice) {
      utterance.voice = voice;
    }

    let finished = false;

    const done = (result) => {
      if (finished) return;
      finished = true;
      resolve(result);
    };

    utterance.onstart = () => done(true);

    utterance.onerror = (event) => {
      logWarning(`Speech synthesis failed: ${event.error}`);
      done(false);
    };

    speechSynthesis.cancel();

    setTimeout(() => {
      try {
        speechSynthesis.speak(utterance);
      } catch (error) {
        logWarning(`Speech synthesis exception: ${error.message}`);
        done(false);
      }
    }, 0);

    setTimeout(() => done(true), 1200);
  });
};

const playWithGoogleTts = async (
  cleanText,
  languageCode,
  dependencies = {},
) => {
  const AudioCtor = dependencies.AudioCtor || globalThis.Audio;
  const logWarning = dependencies.logWarning || console.warn;

  if (!AudioCtor) return false;

  try {
    const src = createGoogleTtsUrl(cleanText, languageCode);
    const audio = new AudioCtor(src);

    audio.preload = 'auto';
    audio.playsInline = true;

    await audio.play();

    return true;
  } catch (error) {
    logWarning(`Google TTS playback failed: ${error.message}`);
    return false;
  }
};

export const playPronunciation = async (
  text,
  languageCode,
  dependencies = {},
) => {
  const cleanText = String(text || '').trim();

  if (!cleanText || !languageCode) {
    return false;
  }

  const mobile = isMobileBrowser();

  if (mobile) {
    const speechOk = await playWithSpeechSynthesis(
      cleanText,
      languageCode,
      dependencies,
    );

    if (speechOk) return true;

    return playWithGoogleTts(cleanText, languageCode, dependencies);
  }

  const googleOk = await playWithGoogleTts(
    cleanText,
    languageCode,
    dependencies,
  );

  if (googleOk) return true;

  return playWithSpeechSynthesis(cleanText, languageCode, dependencies);
};
