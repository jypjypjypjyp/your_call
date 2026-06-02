export interface Suggestion {
  title: string;
  description: string;
  file?: string;
  diff: string;
  replacement?: string;
}

export interface ContextDocument {
  fileName: string;
  languageId: string;
  content: string;
  isActive: boolean;
  cursorLine: number;
  nearCursorCode: string;
}


export type WebViewMessage =
  | { type: 'applySuggestion'; suggestion: Suggestion }
  | { type: 'resetSuggestion'; suggestion: Suggestion }
  | { type: 'regenerate'; userIntent: string }
  | { type: 'viewDiff'; suggestion: Suggestion }
  | { type: 'stop' }
  | { type: 'selectModel' };

export type ExtensionMessage =
  | { type: 'modelChanged'; model: string }
  | { type: 'suggestions'; suggestions: Suggestion[] }
  | { type: 'error'; message: string }
  | { type: 'loading' }
  | { type: 'streamStart' }
  | { type: 'streamChunk'; reasoning: string; content: string }
  | { type: 'streamEnd' };
