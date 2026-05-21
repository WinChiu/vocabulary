const GOOGLE_TRANSLATE_TTS_BASE_URL =
  'https://translate.google.com/translate_tts';

export const createGoogleTtsUrl = (text, languageCode) => {
  const cleanText = String(text || '').trim();
  return `${GOOGLE_TRANSLATE_TTS_BASE_URL}?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
    languageCode,
  )}&q=${encodeURIComponent(cleanText)}`;
};

export const getSpeechSynthesisLanguage = (languageCode) => {
  const locales = {
    en: 'en-US',
    sv: 'sv-SE',
  };

  return locales[languageCode] || languageCode;
};

export const playPronunciation = async (
  text,
  languageCode,
  dependencies = {},
) => {
  const cleanText = String(text || '').trim();
  if (!cleanText || !languageCode) return false;

  const AudioCtor = dependencies.AudioCtor || globalThis.Audio;
  const speechSynthesis =
    dependencies.speechSynthesis || globalThis.speechSynthesis;
  const SpeechSynthesisUtteranceCtor =
    dependencies.SpeechSynthesisUtteranceCtor ||
    globalThis.SpeechSynthesisUtterance;
  const logWarning = dependencies.logWarning || console.warn;

  if (AudioCtor) {
    try {
      const audio = new AudioCtor(createGoogleTtsUrl(cleanText, languageCode));
      await audio.play();
      return true;
    } catch (error) {
      logWarning('Google TTS playback failed, using browser speech:', error);
    }
  }

  if (speechSynthesis && SpeechSynthesisUtteranceCtor) {
    const utterance = new SpeechSynthesisUtteranceCtor(cleanText);
    utterance.lang = getSpeechSynthesisLanguage(languageCode);
    speechSynthesis.cancel?.();
    speechSynthesis.speak(utterance);
    return true;
  }

  return false;
};
