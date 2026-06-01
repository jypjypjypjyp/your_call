import * as vscode from 'vscode';
import { Suggestion, WebViewMessage } from './types';
import { getSidebarHtml } from './sidebar';
import { collectContext } from './ContextCollector';
import { fetchSuggestions } from './CompletionApi';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiCompletion.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _secretStorage: vscode.SecretStorage) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getSidebarHtml([], false, '');

    webviewView.webview.onDidReceiveMessage(async (msg: WebViewMessage) => {
      switch (msg.type) {
        case 'ready':
          this.autoComplete();
          break;
        case 'regenerate':
          this.autoComplete(msg.userIntent);
          break;
        case 'applySuggestion':
          this.applySuggestion(msg.suggestion);
          break;
        case 'viewDiff':
          this.viewDiff(msg.suggestion);
          break;
      }
    });
  }

  private async autoComplete(userIntent = ''): Promise<void> {
    if (!this._view) return;

    try {
      this._view.webview.html = getSidebarHtml([], true, '');
      this._view.title = 'AI 代码补全 (分析中...)';

      const { documents, cursorFile, cursorLine } = collectContext();

      if (documents.length === 0) {
        this._view.webview.html = getSidebarHtml([], false, '请先打开代码文件');
        this._view.title = 'AI 代码补全';
        return;
      }

      const apiKey = (await this._secretStorage.get('aiCompletion.apiKey')) ?? '';
      if (!apiKey) {
        this._view.webview.html = getSidebarHtml([], false, '请先在设置中配置 API Key');
        this._view.title = 'AI 代码补全';
        return;
      }

      const suggestions = await fetchSuggestions(documents, cursorFile, cursorLine, userIntent, apiKey);
      this._view.webview.html = getSidebarHtml(suggestions, false, '');
      this._view.title = `AI 代码补全 (${suggestions.length} 个方案)`;
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message.includes('API Key')
        ? '请先在设置中配置 API Key'
        : `请求失败: ${e instanceof Error ? e.message : String(e)}`;
      this._view.webview.html = getSidebarHtml([], false, msg);
      this._view.title = 'AI 代码补全';
    }
  }

  private applySuggestion(suggestion: Suggestion): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const edits = parseUnifiedDiff(suggestion.diff, editor.document);
      if (edits.length === 0) {
        vscode.window.showWarningMessage('未识别到可应用的改动');
        return;
      }

      const edit = new vscode.WorkspaceEdit();
      let skippedCount = 0;
      for (const e of edits) {
        if (e.contextLines && !contextMatches(editor.document, e)) {
          skippedCount++;
          continue;
        }
        edit.replace(editor.document.uri, e.range, e.newText);
      }

      if (skippedCount > 0) {
        vscode.window.showWarningMessage(`${skippedCount} 处改动因文件已变化而跳过`);
      }

      if (edit.size > 0) {
        vscode.workspace.applyEdit(edit).then(success => {
          if (success) {
            vscode.window.showInformationMessage(`已应用方案: ${suggestion.title}`);
          }
        });
      }
    } catch (e: unknown) {
      vscode.window.showErrorMessage(`应用失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private viewDiff(suggestion: Suggestion): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const diffContent = `--- 原始文件\n+++ 改动后\n\n${suggestion.diff}`;

    vscode.workspace.openTextDocument({ content: diffContent, language: 'diff' }).then(doc => {
      vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    });
  }
}

interface DiffEdit {
  range: vscode.Range;
  newText: string;
  contextLines?: { text: string; line: number }[];
}

function parseUnifiedDiff(diff: string, document: vscode.TextDocument): DiffEdit[] {
  const edits: DiffEdit[] = [];
  const lines = diff.split('\n');
  let i = 0;

  while (i < lines.length) {
    const hunkMatch = lines[i].match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
    if (!hunkMatch) { i++; continue; }

    const origStart = parseInt(hunkMatch[1]);
    const origCount = parseInt(hunkMatch[2] || '1');

    i++;
    const contextLines: { text: string; line: number }[] = [];
    const newLines: string[] = [];
    let origLine = origStart;

    while (i < lines.length && !lines[i].startsWith('@@')) {
      const line = lines[i];
      if (line.startsWith('-')) {
        origLine++;
      } else if (line.startsWith('+')) {
        newLines.push(line.slice(1));
      } else {
        contextLines.push({ text: line.slice(1), line: origLine });
        newLines.push(line.slice(1));
        origLine++;
      }
      i++;
    }

    const range = new vscode.Range(
      new vscode.Position(origStart - 1, 0),
      new vscode.Position(origStart - 1 + origCount, 0)
    );

    edits.push({
      range,
      newText: newLines.join('\n') + (newLines.length > 0 ? '\n' : ''),
      contextLines,
    });
  }

  // Apply bottom-to-top to avoid line drift
  edits.sort((a, b) => b.range.start.line - a.range.start.line);
  return edits;
}

function contextMatches(document: vscode.TextDocument, edit: DiffEdit): boolean {
  if (!edit.contextLines || edit.contextLines.length === 0) return true;
  const first = edit.contextLines[0];
  if (first.line <= document.lineCount) {
    const actual = document.lineAt(first.line - 1).text;
    return actual.trim() === first.text.trim();
  }
  return false;
}
