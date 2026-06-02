import * as vscode from 'vscode';
import { ContextDocument } from './types';


export function collectContext(): { documents: ContextDocument[]; cursorFile: string; cursorLine: number; selectionStart: number; selectionEnd: number } {
  const config = vscode.workspace.getConfiguration('aiCompletion');
  const maxLines = config.get<number>('maxFileLines', 500);
  const maxFiles = config.get<number>('maxOpenFiles', 10);

  const activeEditor = vscode.window.activeTextEditor;
  const activeFileName = activeEditor?.document.fileName;
  const sel = activeEditor?.selection;
  const hasSelection = sel && !sel.isEmpty;
  const cursorLine = (sel?.active.line ?? 0) + 1; // 1-indexed

  // Use selection range if present, otherwise cursor ±30
  const selectionStart = hasSelection ? (sel!.start.line + 1) : Math.max(1, cursorLine - 30);
  const selectionEnd = hasSelection ? (sel!.end.line + 1) : cursorLine + 30;

  const documents: ContextDocument[] = [];
  let collected = 0;

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (collected >= maxFiles) break;
      const input = tab.input;
      if (!(input instanceof vscode.TabInputText)) continue;

      const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === input.uri.fsPath);
      if (!doc) continue;


      const content = doc.getText();
      const lines = content.split('\n');
      const truncated = lines.length > maxLines
        ? lines.slice(0, maxLines).join('\n') + '\n// ... [截断]'
        : content;

      // Extract selection/cursor range code for active file
      let nearCursorCode = '';
      if (doc.uri.fsPath === activeFileName) {
        const start = Math.max(0, selectionStart - 1);
        const end = Math.min(lines.length, selectionEnd);
        nearCursorCode = lines.slice(start, end).join('\n');
      }

      documents.push({
        fileName: doc.uri.fsPath,
        languageId: doc.languageId,
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
    selectionStart,
    selectionEnd,
  };
}
