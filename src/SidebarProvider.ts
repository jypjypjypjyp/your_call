import * as vscode from 'vscode';
import { Suggestion, WebViewMessage, ExtensionMessage } from './types';
import { getSidebarHtml } from './sidebar';
import { collectContext } from './ContextCollector';
import { fetchSuggestions, streamSuggestions } from './CompletionApi';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiCompletion.sidebar';
  private _view?: vscode.WebviewView;

  private get currentModel(): string {
    return vscode.workspace.getConfiguration('aiCompletion').get<string>('model', '');
  }

  constructor(
    private readonly _secretStorage: vscode.SecretStorage,
    private readonly _extensionUri: vscode.Uri
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = getSidebarHtml([], false, '输入意图（可选），点击"生成建议"', this.currentModel);

    webviewView.webview.onDidReceiveMessage(async (msg: WebViewMessage) => {
      switch (msg.type) {
        case 'regenerate':
          this.autoComplete(msg.userIntent);
          break;
        case 'applySuggestion':
          this.applySuggestion(msg.suggestion);
          break;
        case 'viewDiff':
          this.viewDiff(msg.suggestion);
          break;
        case 'selectModel':
          await this.selectModel();
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this._view = undefined;
    });

  }

  private async autoComplete(userIntent = ''): Promise<void> {
    if (!this._view) return;

    try {
      const { documents, cursorFile, cursorLine, selectionStart, selectionEnd } = collectContext();

      if (documents.length === 0) {
        this._view.webview.html = getSidebarHtml([], false, '请先打开代码文件', this.currentModel);
        this._view.title = 'AI 代码补全';
        return;
      }

      const apiKey = (await this._secretStorage.get('aiCompletion.apiKey')) ?? '';
      if (!apiKey) {
        this._view.webview.html = getSidebarHtml([], false, '请先在设置中配置 API Key', this.currentModel);
        this._view.title = 'AI 代码补全';
        return;
      }

      // Switch to streaming view
      this._view.webview.html = getSidebarHtml([], false, '', this.currentModel, true);
      this._view.title = 'AI 代码补全 (生成中...)';

      const suggestions = await streamSuggestions(
        documents, cursorFile, cursorLine, userIntent, apiKey,
        (reasoning, content) => {
          this._view?.webview.postMessage({ type: 'streamChunk', reasoning, content });
        },
        selectionStart, selectionEnd,
      );

      // Streaming done — switch to card view
      this._view.webview.postMessage({ type: 'streamEnd' });
      this._view.webview.html = getSidebarHtml(suggestions, false, '', this.currentModel);
      this._view.title = `AI 代码补全 (${suggestions.length} 个方案)`;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      vscode.window.showErrorMessage(`[AI Completion] ${errMsg}`);
      const displayMsg = errMsg.includes('Invalid model')
        ? `模型无效，请运行命令 "AI Completion: Select Model" 选择合适的模型\n\n${errMsg}`
        : errMsg;
      this._view.webview.html = getSidebarHtml([], false, displayMsg, this.currentModel);
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
        }).catch(err => {
          vscode.window.showErrorMessage(`应用失败: ${err.message}`);
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
    }, err => {
      vscode.window.showErrorMessage(`打开 diff 失败: ${err.message}`);
    });
  }

  private async selectModel(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('aiCompletion');
    const baseUrl = cfg.get<string>('apiBaseUrl', 'https://api.openai.com/v1');
    const apiKey = await this._secretStorage.get('aiCompletion.apiKey');
    if (!apiKey) {
      vscode.window.showErrorMessage('请先配置 API Key');
      return;
    }

    const { listModels } = await import('./CompletionApi');
    const models = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: '正在获取模型列表...' },
      async () => {
        try {
          return await listModels(baseUrl, apiKey);
        } catch (e: any) {
          vscode.window.showErrorMessage(`获取模型列表失败: ${e.message}`);
          return null;
        }
      }
    );

    if (!models || models.length === 0) return;

    const current = cfg.get<string>('model', '');
    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: '选择 AI 模型',
      matchOnDescription: true,
    });

    if (selected) {
      await cfg.update('model', selected, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`模型已切换为: ${selected}`);
      // Update sidebar header
      if (this._view) {
        this._view.webview.postMessage({ type: 'modelChanged', model: selected });
      }
    }
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
