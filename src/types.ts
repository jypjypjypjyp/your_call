export interface Suggestion {
  title: string;
  description: string;
  file?: string;
  diff: string;
}

export interface ContextDocument {
  fileName: string;
  languageId: string;
  content: string;
  isActive: boolean;
  cursorLine: number;
  nearCursorCode: string;
}

export interface CompletionConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  maxFileLines: number;
  maxOpenFiles: number;
  suggestionCount: number;
}

// WebView ↔ Extension 消息协议
export type ExtensionMessage =
  | { type: 'suggestions'; suggestions: Suggestion[] }
  | { type: 'error'; message: string }
  | { type: 'loading' };

export type WebViewMessage =
  | { type: 'applySuggestion'; suggestion: Suggestion }
  | { type: 'regenerate'; userIntent: string }
  | { type: 'viewDiff'; suggestion: Suggestion }
  | { type: 'ready' };
