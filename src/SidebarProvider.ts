import * as vscode from 'vscode';
import { Suggestion, WebViewMessage, ExtensionMessage } from './types';
import { getSidebarHtml } from './sidebar';
import { collectContext } from './ContextCollector';
import { fetchSuggestions, streamSuggestions } from './CompletionApi';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'yourcall.sidebar';
  private _view?: vscode.WebviewView;
  private _abortController: AbortController | null = null;

  private get currentModel(): string {
    return vscode.workspace.getConfiguration('yourcall').get<string>('model', '');
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
    webviewView.webview.html = getSidebarHtml([], false, vscode.l10n.t('Enter intent or click Generate'), this.currentModel);

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
        case 'resetSuggestion':
          this.autoComplete(`优化方案：${msg.suggestion.title} - ${msg.suggestion.description}\n\n原方案的修改内容：\n${msg.suggestion.diff}\n\n请保持修改意图不变，优化实现方式。`);
          break;
        case 'stop': {
          if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
          }
          const view = this._view;
          if (view) {
            view.webview.postMessage({ type: 'streamEnd' });
            view.webview.html = getSidebarHtml([], false, vscode.l10n.t('Enter intent or click Generate'), this.currentModel);
            view.title = vscode.l10n.t('AI Code Completion');
          }
          break;
        }
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
        this._view.webview.html = getSidebarHtml([], false, vscode.l10n.t('Open a code file first'), this.currentModel);
        this._view.title = vscode.l10n.t('AI Code Completion');
        return;
      }

      const apiKey = (await this._secretStorage.get('yourcall.apiKey')) ?? '';
      if (!apiKey) {
        this._view.webview.html = getSidebarHtml([], false, vscode.l10n.t('Configure API Key in settings first'), this.currentModel);
        this._view.title = vscode.l10n.t('AI Code Completion');
        return;
      }

      // Switch to streaming view
      this._view.webview.html = getSidebarHtml([], false, '', this.currentModel, true);
      this._view.title = vscode.l10n.t('AI Code Completion (generating...)');

      this._abortController = new AbortController();

      const suggestions = await streamSuggestions(
        documents, cursorFile, cursorLine, userIntent, apiKey,
        (reasoning, content) => {
          this._view?.webview.postMessage({ type: 'streamChunk', reasoning, content });
        },
        selectionStart, selectionEnd, this._abortController.signal,
      );

      // Streaming done — switch to card view
      this._view.webview.postMessage({ type: 'streamEnd' });
      this._view.webview.html = getSidebarHtml(suggestions, false, '', this.currentModel);
      this._view.title = vscode.l10n.t('AI Code Completion ({count} suggestions)', { count: suggestions.length });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      vscode.window.showErrorMessage(vscode.l10n.t('[AI Completion] {msg}', { msg: errMsg }));
      const displayMsg = errMsg.includes('Invalid model')
        ? `${vscode.l10n.t('Invalid model run Select Model')}\n\n${errMsg}`
        : errMsg;
      this._view.webview.html = getSidebarHtml([], false, displayMsg, this.currentModel);
      this._view.title = vscode.l10n.t('AI Code Completion');
    } finally {
      this._abortController = null;
    }
  }

  private applySuggestion(suggestion: Suggestion): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    if (!suggestion.replacement) return;

    const sel = editor.selection;
    const range = sel.isEmpty
      ? new vscode.Range(Math.max(0, sel.active.line - 30), 0, sel.active.line + 30, 0)
      : new vscode.Range(sel.start.line, 0, sel.end.line, 0);
    editor.edit(editBuilder => {
      editBuilder.replace(range, suggestion.replacement!);
    }).then(success => {
      if (success) vscode.window.showInformationMessage(vscode.l10n.t('Applied: {title}', { title: suggestion.title }));
    });
  }

  private viewDiff(suggestion: Suggestion): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const diffContent = `--- 原始文件\n+++ 改动后\n\n${suggestion.diff}`;

    vscode.workspace.openTextDocument({ content: diffContent, language: 'diff' }).then(doc => {
      vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    }, err => {
      vscode.window.showErrorMessage(vscode.l10n.t('Open diff failed: {msg}', { msg: err.message }));
    });
  }

  private async selectModel(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('yourcall');
    const baseUrl = cfg.get<string>('apiBaseUrl', 'https://api.openai.com/v1');
    const apiKey = await this._secretStorage.get('yourcall.apiKey');
    if (!apiKey) {
      vscode.window.showErrorMessage(vscode.l10n.t('Configure AI API Key first'));
      return;
    }

    const { listModels } = await import('./CompletionApi');
    const models = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('Fetching model list...') },
      async () => {
        try {
          return await listModels(baseUrl, apiKey);
        } catch (e: any) {
          vscode.window.showErrorMessage(vscode.l10n.t('Failed to fetch model list: {msg}', { msg: e.message }));
          return null;
        }
      }
    );

    if (!models || models.length === 0) return;

    const current = cfg.get<string>('model', '');
    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: vscode.l10n.t('Select AI model'),
      matchOnDescription: true,
    });

    if (selected) {
      await cfg.update('model', selected, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(vscode.l10n.t('Model switched to: {model}', { model: selected }));
      // Update sidebar header
      if (this._view) {
        this._view.webview.postMessage({ type: 'modelChanged', model: selected });
      }
    }
  }
}

