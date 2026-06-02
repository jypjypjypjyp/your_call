import * as vscode from 'vscode';
import * as path from 'path';
import { SidebarProvider } from './SidebarProvider';
import { AgentProvider } from './AgentProvider';
import { listModels } from './CompletionApi';

export function activate(context: vscode.ExtensionContext): void {
  // Register sidebar provider
  const provider = new SidebarProvider(context.secrets, context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register Agent CLI provider
  const agentProvider = new AgentProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentProvider.viewType, agentProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register open sidebar command (Ctrl+Shift+Space)
  // Register open sidebar command
  const openSidebarCmd = vscode.commands.registerCommand('aiCompletion.openSidebar', () => {
    vscode.commands.executeCommand('workbench.view.extension.ai-completion')
      .then(undefined, () => { /* ignore */ });
  });
  context.subscriptions.push(openSidebarCmd);

  // Register configure API Key command
  const configureApiKeyCmd = vscode.commands.registerCommand('aiCompletion.configureApiKey', async () => {
    const key = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter OpenAI API Key'),
      password: true,
      placeHolder: 'sk-...',
      ignoreFocusOut: true,
    });
    if (key) {
      await context.secrets.store('aiCompletion.apiKey', key);
      vscode.window.showInformationMessage(vscode.l10n.t('API Key saved'));
    }
  });
  context.subscriptions.push(configureApiKeyCmd);

  // Register select model command
  const selectModelCmd = vscode.commands.registerCommand('aiCompletion.selectModel', async () => {
    const cfg = vscode.workspace.getConfiguration('aiCompletion');
    const baseUrl = cfg.get<string>('apiBaseUrl', 'https://api.openai.com/v1');
    const apiKey = await context.secrets.get('aiCompletion.apiKey');
    if (!apiKey) {
      vscode.window.showErrorMessage(vscode.l10n.t('Configure AI API Key first'));
      return;
    }

    // Fetch models with loading indicator
    const models = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('Fetching model list...') },
      async () => {
        try {
          return await listModels(baseUrl, apiKey);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          vscode.window.showErrorMessage(vscode.l10n.t('Failed to fetch model list: {msg}', { msg }));
          return null;
        }
      }
    );

    if (!models || models.length === 0) return;

    const current = cfg.get<string>('model', '');
    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: vscode.l10n.t('Select AI model'),
      matchOnDescription: true,
      canPickMany: false,
    });

    if (selected) {
      await cfg.update('model', selected, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(vscode.l10n.t('Model switched to: {model}', { model: selected }));
    }
  });
  context.subscriptions.push(selectModelCmd);

  // Register copy code position command
  const copyCodeCmd = vscode.commands.registerCommand('yourcall.copyCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(vscode.l10n.t('No active editor'));
      return;
    }
    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage(vscode.l10n.t('Select code first'));
      return;
    }
    const document = editor.document;
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const filePath = folder ? path.relative(folder.uri.fsPath, document.uri.fsPath) : document.uri.fsPath;
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    await vscode.env.clipboard.writeText(`${filePath}:${startLine}-${endLine}`);
    vscode.window.showInformationMessage(vscode.l10n.t('Copied: {filePath}:{startLine}-{endLine}', { filePath, startLine, endLine }));
  });
  context.subscriptions.push(copyCodeCmd);

  // Register copy file path command
  const copyPathCmd = vscode.commands.registerCommand('yourcall.copyFilePath', async (arg: vscode.Uri | undefined, uris: vscode.Uri[] | undefined) => {
    const filePaths: string[] = [];
    const files = (uris && uris.length > 0) ? uris : (arg instanceof vscode.Uri ? [arg] : []);
    if (files.length === 0) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const doc = editor.document;
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      filePaths.push(folder ? path.relative(folder.uri.fsPath, doc.uri.fsPath) : doc.uri.fsPath);
    } else {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      for (const f of files) {
        filePaths.push(root ? path.relative(root, f.fsPath) : f.fsPath);
      }
    }
    await vscode.env.clipboard.writeText(filePaths.join('; '));
    vscode.window.showInformationMessage(vscode.l10n.t('Copied {count} file paths', { count: filePaths.length }));
  });
  context.subscriptions.push(copyPathCmd);

  // Migrate API Key from settings.json to SecretStorage (if present)
  const apiKeyConfig = vscode.workspace.getConfiguration('aiCompletion').get<string>('apiKey');
  if (apiKeyConfig) {
    context.secrets.store('aiCompletion.apiKey', apiKeyConfig).then(() => {
      vscode.workspace.getConfiguration('aiCompletion').update('apiKey', undefined, vscode.ConfigurationTarget.Global);
    });
  }
}

export function deactivate(): void {
  // Cleanup (none needed currently)
}
