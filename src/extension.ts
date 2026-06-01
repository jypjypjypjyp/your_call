import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Completion extension activated');

  const openSidebar = vscode.commands.registerCommand('aiCompletion.openSidebar', () => {
    console.log('openSidebar command triggered');
  });

  const configureApiKey = vscode.commands.registerCommand('aiCompletion.configureApiKey', () => {
    console.log('configureApiKey command triggered');
  });

  context.subscriptions.push(openSidebar, configureApiKey);
}

export function deactivate() {
  // cleanup
}
