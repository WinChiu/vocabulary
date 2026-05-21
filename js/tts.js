export const getSpeechSynthesisLanguage = (languageCode) => {
  const locales = {
    en: "en-US",
    sv: "sv-SE",
  };

  return locales[languageCode] || languageCode;
};

const getSpeechSynthesisVoices = (speechSynthesis) =>
  new Promise((resolve) => {
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
