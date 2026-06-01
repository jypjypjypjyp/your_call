import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext): void {
  // Register sidebar provider
  const provider = new SidebarProvider(context.secrets);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register open sidebar command
  const openSidebarCmd = vscode.commands.registerCommand('aiCompletion.openSidebar', () => {
    vscode.commands.executeCommand('workbench.view.extension.ai-completion');
  });
  context.subscriptions.push(openSidebarCmd);

  // Register configure API Key command
  const configureApiKeyCmd = vscode.commands.registerCommand('aiCompletion.configureApiKey', async () => {
    const key = await vscode.window.showInputBox({
      prompt: '请输入 OpenAI 兼容 API Key',
      password: true,
      placeHolder: 'sk-...',
      ignoreFocusOut: true,
    });
    if (key) {
      await context.secrets.store('aiCompletion.apiKey', key);
      vscode.window.showInformationMessage('API Key 已保存');
    }
  });
  context.subscriptions.push(configureApiKeyCmd);

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
