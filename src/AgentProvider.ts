import * as vscode from 'vscode';
import type { IPty } from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';

export class AgentProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'yourcall.agent';
  private _view?: vscode.WebviewView;
  private _pty: IPty | null = null;

  constructor(private readonly _uri: vscode.Uri) {}

  resolveWebviewView(vw: vscode.WebviewView): void {
    this._view = vw;
    vw.webview.options = { enableScripts: true, localResourceRoots: [this._uri] };
    vw.webview.html = this._buildHtml();
    vw.onDidDispose(() => this._kill());
    vw.webview.onDidReceiveMessage(async m => {
      if (m.type === 'start') this._start(m.cmd as string | undefined);
      else if (m.type === 'stop') this._kill();
      else if (m.type === 'data' && this._pty) this._pty.write(m.text);
      else if (m.type === 'resize' && this._pty) this._pty.resize(m.cols, m.rows);
      else if (m.type === 'openFile') {
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const fp = path.isAbsolute(m.path) ? m.path : path.join(ws, m.path);
        try {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fp));
          const ln = Math.max((m.line || 1) - 1, 0);
          const co = Math.max((m.column || 1) - 1, 0);
          const pos = new vscode.Position(ln, co);
          await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), preview: false });
        } catch { /* file not found */ }
      }
    });
  }

  private _buildHtml(): string {
    const extPath = this._uri.fsPath;
    const defaultCmd = (vscode.workspace.getConfiguration('yourcall').get<string>('agentCommand', '') || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let xtermJs = '';
    let xtermCss = '';
    let fitAddonJs = '';
    try {
      xtermJs = fs.readFileSync(path.join(extPath, 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.js'), 'utf8');
      xtermCss = fs.readFileSync(path.join(extPath, 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css'), 'utf8');
      fitAddonJs = fs.readFileSync(path.join(extPath, 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js'), 'utf8');
    } catch { /* files not available */ }

    const agentJsUri = this._view?.webview.asWebviewUri(vscode.Uri.joinPath(this._uri, 'media', 'agent.js'));
    let template = '';
    try {
      template = fs.readFileSync(path.join(extPath, 'media', 'agent.html'), 'utf8');
    } catch { return ''; }

    return template
      .replace('{{XTERM_CSS}}', `<style>${xtermCss}</style>`)
      .replace('{{XTERM_JS}}', `<script>${xtermJs}</script>`)
      .replace('{{FIT_JS}}', `<script>${fitAddonJs}</script>`)
      .replace('{{AGENT_JS_URI}}', String(agentJsUri || ''))
      .replace(/{{START_BTN}}/g, esc(vscode.l10n.t('Start')))
      .replace(/{{STOP_BTN}}/g, esc(vscode.l10n.t('Stop')))
      .replace(/{{CMD_PLACEHOLDER}}/g, esc(vscode.l10n.t('agent command')))
      .replace(/{{DEFAULT_CMD}}/g, defaultCmd)
      .replace(/{{INIT_FAILED_MSG}}/g, esc(vscode.l10n.t('Init failed: {msg}', { msg: '' })))
      .replace(/{{ERROR_MSG}}/g, esc(vscode.l10n.t('Error: {msg}', { msg: '' })));
  }

  private _start(cmdOverride?: string): void {
    const raw = (cmdOverride || vscode.workspace.getConfiguration('yourcall').get<string>('agentCommand', '') || '').trim();
    if (!raw) {
      vscode.window.showErrorMessage(vscode.l10n.t('Configure yourcall.agentCommand in settings'));
      return;
    }

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const isWin = process.platform === 'win32';
    const shellCmd = isWin ? 'cmd.exe' : 'bash';
    const shellArgs = isWin ? ['/c', `chcp 65001 > NUL & ${raw}`] : ['-l', '-i', '-c', raw];

    this._view?.webview.postMessage({ type: 'c', t: raw });

    let pty: typeof import('node-pty');
    try {
      pty = require('node-pty');
    } catch {
      this._view?.webview.postMessage({ type: 'o', t: `\r\n${esc(vscode.l10n.t('node-pty not installed. Restart VS Code after install completes.'))}\r\n` });
      this._view?.webview.postMessage({ type: 'e', t: 'node-pty not found' });
      return;
    }

    try {
      this._pty = pty.spawn(shellCmd, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' },
      });

      this._view?.webview.postMessage({ type: 's' });

      // Burst detection: buffer during rapid writes, flush when quiet for 80ms
      // This prevents flicker from CLI tools that do frequent full-screen redraws (omp, etc.)
      let _buf = '';
      let _tid: ReturnType<typeof setTimeout> | null = null;
      this._pty.onData((data: string) => {
        _buf += data;
        if (_tid) clearTimeout(_tid);
        _tid = setTimeout(() => {
          this._view?.webview.postMessage({ type: 'o', t: _buf });
          _buf = '';
          _tid = null;
        }, 16);
      });

      this._pty.onExit(() => {
        this._pty = null;
        this._view?.webview.postMessage({ type: 'x' });
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this._view?.webview.postMessage({ type: 'o', t: `\r\n${vscode.l10n.t('Start failed: {msg}', { msg })}\r\n` });
      this._view?.webview.postMessage({ type: 'e', t: msg });
      vscode.window.showErrorMessage(vscode.l10n.t('Agent CLI start failed: {msg}', { msg }));
    }
  }

  private _kill(): void {
    if (this._pty) { this._pty.kill(); this._pty = null; }
    this._view?.webview.postMessage({ type: 'x' });
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
