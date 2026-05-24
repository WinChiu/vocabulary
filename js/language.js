export const LANGUAGE_STORAGE_KEY = 'just-word-language-mode';

const LANGUAGE_MODES = {
  en: {
    mode: 'en',
    collection: 'cards',
    sourceLabel: 'Word',
    sourcePlaceholder: 'hej',
    exampleLabel: 'Example',
    examplePlaceholder: 'Hej! Hur mar du?',
    addTitle: 'Add word',
    editTitle: 'Edit word',
    saveActionLabel: 'Save word',
    updateActionLabel: 'Update word',
    addExampleActionLabel: 'Add example',
    searchPlaceholder: '搜尋單字或中文意思...',
    importTitle: 'Import',
    dictionaryLanguage: 'en',
    dictionaryEnabled: true,
    ttsLanguage: 'en',
  },
  sv: {
    mode: 'sv',
    collection: 'cards_sv',
    sourceLabel: 'Word',
    sourcePlaceholder: 'hej',
    exampleLabel: 'Example',
    examplePlaceholder: 'e.g., Det ar lagom varmt idag.',
    addTitle: 'Add word',
    editTitle: 'Edit word',
    saveActionLabel: 'Save word',
    updateActionLabel: 'Update word',
    addExampleActionLabel: 'Add example',
    searchPlaceholder: '搜尋單字或中文意思...',
    importTitle: 'Import',
    dictionaryLanguage: null,
    dictionaryEnabled: false,
    ttsLanguage: 'sv',
  },
};

export const normalizeLanguageMode = (mode) =>
  Object.prototype.hasOwnProperty.call(LANGUAGE_MODES, mode) ? mode : 'en';

export const getLanguageConfig = (mode) =>
  LANGUAGE_MODES[normalizeLanguageMode(mode)];
