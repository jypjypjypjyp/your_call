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


export type WebViewMessage =
  | { type: 'applySuggestion'; suggestion: Suggestion }
  | { type: 'regenerate'; userIntent: string }
  | { type: 'viewDiff'; suggestion: Suggestion }
  | { type: 'ready' };
