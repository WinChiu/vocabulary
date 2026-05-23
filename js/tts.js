export const getSpeechSynthesisLanguage = (languageCode) => {
  const locales = {
    en: "en-US",
    sv: "sv-SE",
  };

  return locales[languageCode] || languageCode;
};

export const createGoogleTtsUrl = (text, languageCode) => {
  const cleanText = String(text || "").trim();

  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(languageCode)}&q=${encodeURIComponent(cleanText)}`;
};

const getSpeechSynthesisVoices = (speechSynthesis) =>
  new Promise((resolve) => {
    if (typeof speechSynthesis.getVoices !== "function") {
      resolve([]);
      return;
    }

    const voices = speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
  });

const findVoice = (voices, languageCode) => {
  const language = getSpeechSynthesisLanguage(languageCode);

  return (
    voices.find((voice) => voice.lang === language) ||
    voices.find((voice) => voice.lang.startsWith(languageCode)) ||
    null
  );
};

export const playPronunciation = async (
  text,
  languageCode,
  dependencies = {},
) => {
  const cleanText = String(text || "").trim();
  if (!cleanText || !languageCode) return false;

  const speechSynthesis =
    dependencies.speechSynthesis || globalThis.speechSynthesis;

  const SpeechSynthesisUtteranceCtor =
    dependencies.SpeechSynthesisUtteranceCtor ||
    globalThis.SpeechSynthesisUtterance;

  const logWarning = dependencies.logWarning || console.warn;
  const AudioCtor = dependencies.AudioCtor || globalThis.Audio;

  if (AudioCtor) {
    try {
      const audio = new AudioCtor(createGoogleTtsUrl(cleanText, languageCode));
      await audio.play();
      return true;
    } catch (error) {
      logWarning(`Google TTS playback failed: ${error.message}`);
    }
  }

  if (!speechSynthesis || !SpeechSynthesisUtteranceCtor) {
    return false;
  }

  const voices = await getSpeechSynthesisVoices(speechSynthesis);
  const voice = findVoice(voices, languageCode);
  const lang = getSpeechSynthesisLanguage(languageCode);

  if (!voice) {
    logWarning(`No speech synthesis voice found for ${lang}.`);
  }

  const utterance = new SpeechSynthesisUtteranceCtor(cleanText);
  utterance.lang = lang;

  if (voice) {
    utterance.voice = voice;
  }

  speechSynthesis.cancel?.();
  speechSynthesis.speak(utterance);

  return true;
};
