export const LANGUAGE_STORAGE_KEY = 'just-word-language-mode';

export const LANGUAGE_MODES = {
  en: {
    mode: 'en',
    collection: 'cards',
    sourceLabel: '單字',
    sourceShort: 'EN',
    sourceName: 'English',
    sourcePlaceholder: 'hej',
    exampleLabel: '例句',
    examplePlaceholder: 'Hej! Hur mar du?',
    addTitle: '新增單字',
    editTitle: '編輯單字',
    searchPlaceholder: '搜尋單字或中文意思...',
    importTitle: '匯入單字',
    addActionLabel: '新增',
    dictionaryLanguage: 'en',
    dictionaryEnabled: true,
    ttsLanguage: 'en',
  },
  sv: {
    mode: 'sv',
    collection: 'cards_sv',
    sourceLabel: '單字',
    sourceShort: 'SV',
    sourceName: 'Swedish',
    sourcePlaceholder: 'hej',
    exampleLabel: '例句',
    examplePlaceholder: 'e.g., Det ar lagom varmt idag.',
    addTitle: '新增單字',
    editTitle: '編輯單字',
    searchPlaceholder: '搜尋單字或中文意思...',
    importTitle: '匯入單字',
    addActionLabel: '新增',
    dictionaryLanguage: null,
    dictionaryEnabled: false,
    ttsLanguage: 'sv',
  },
};

export const normalizeLanguageMode = (mode) =>
  Object.prototype.hasOwnProperty.call(LANGUAGE_MODES, mode) ? mode : 'en';

export const getLanguageConfig = (mode) =>
  LANGUAGE_MODES[normalizeLanguageMode(mode)];
