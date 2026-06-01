import * as vscode from 'vscode';
import { ContextDocument } from './types';

// Only collect code language files
const CODE_LANGUAGES: Record<string, true> = {
  typescript: true, javascript: true, python: true, rust: true, go: true, java: true,
  cpp: true, c: true, csharp: true, php: true, ruby: true, swift: true, kotlin: true,
  scala: true, dart: true, lua: true, perl: true, r: true, haskell: true, clojure: true,
  elixir: true, erlang: true, zig: true, nim: true,
};

export function collectContext(): { documents: ContextDocument[]; cursorFile: string; cursorLine: number } {
  const config = vscode.workspace.getConfiguration('aiCompletion');
  const maxLines = config.get<number>('maxFileLines', 500);
  const maxFiles = config.get<number>('maxOpenFiles', 10);

  const activeEditor = vscode.window.activeTextEditor;
  const activeFileName = activeEditor?.document.fileName;
  const cursorLine = (activeEditor?.selection.active.line ?? 0) + 1; // 1-indexed

  const documents: ContextDocument[] = [];
  let collected = 0;

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (collected >= maxFiles) break;
      const input = tab.input;
      if (!(input instanceof vscode.TabInputText)) continue;

      const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === input.uri.fsPath);
      if (!doc) continue;

      const langId = doc.languageId;
      if (!CODE_LANGUAGES[langId]) continue;

      const content = doc.getText();
      const lines = content.split('\n');
      const truncated = lines.length > maxLines
        ? lines.slice(0, maxLines).join('\n') + '\n// ... [截断]'
        : content;

      // Extract ±30 lines around cursor for active file
      let nearCursorCode = '';
      if (doc.uri.fsPath === activeFileName) {
        const start = Math.max(0, cursorLine - 31);
        const end = Math.min(lines.length, cursorLine + 30);
        nearCursorCode = lines.slice(start, end).join('\n');
      }

      documents.push({
        fileName: doc.uri.fsPath,
        languageId: langId,
        content: truncated,
        isActive: doc.uri.fsPath === activeFileName,
        cursorLine: doc.uri.fsPath === activeFileName ? cursorLine : -1,
        nearCursorCode,
      });
      collected++;
    }
  }

  return {
    documents,
    cursorFile: activeFileName ?? '',
    cursorLine,
  };
}
