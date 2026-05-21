export const LANGUAGE_STORAGE_KEY = 'just-word-language-mode';

export const LANGUAGE_MODES = {
  en: {
    mode: 'en',
    collection: 'cards',
    sourceLabel: 'English Word',
    sourceShort: 'EN',
    sourceName: 'English',
    sourcePlaceholder: 'e.g., Resilient',
    exampleLabel: 'Example Sentences',
    examplePlaceholder: 'e.g., She is a resilient person.',
    addTitle: 'Add New Word',
    editTitle: 'Edit Word',
    searchPlaceholder: 'Search words...',
    importTitle: 'Import Words',
    addActionLabel: 'Add Word',
    dictionaryLanguage: 'en',
    dictionaryEnabled: true,
    ttsLanguage: 'en',
  },
  sv: {
    mode: 'sv',
    collection: 'cards_sv',
    sourceLabel: 'Swedish Word',
    sourceShort: 'SV',
    sourceName: 'Swedish',
    sourcePlaceholder: 'e.g., lagom',
    exampleLabel: 'Swedish Examples',
    examplePlaceholder: 'e.g., Det ar lagom varmt idag.',
    addTitle: 'Add New Swedish Word',
    editTitle: 'Edit Swedish Word',
    searchPlaceholder: 'Search Swedish words...',
    importTitle: 'Import Swedish Words',
    addActionLabel: 'Add Swedish Word',
    dictionaryLanguage: null,
    dictionaryEnabled: false,
    ttsLanguage: 'sv',
  },
};

export const normalizeLanguageMode = (mode) =>
  Object.prototype.hasOwnProperty.call(LANGUAGE_MODES, mode) ? mode : 'en';

export const getLanguageConfig = (mode) =>
  LANGUAGE_MODES[normalizeLanguageMode(mode)];
