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
    vw.webview.onDidReceiveMessage(m => {
      if (m.type === 'start') this._start(m.cmd as string | undefined);
      else if (m.type === 'stop') this._kill();
      else if (m.type === 'data' && this._pty) this._pty.write(m.text);
      else if (m.type === 'resize' && this._pty) this._pty.resize(m.cols, m.rows);
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

    return `<!DOCTYPE html><html><head><style>${xtermCss}
body{margin:0;padding:0;background:var(--vscode-terminal-background);height:100vh;overflow:hidden;font-family:var(--vscode-editor-font-family);display:flex;flex-direction:column}
#terminal{flex:1;width:100%;min-height:0}
.tb{display:flex;gap:4px;padding:4px 8px;background:var(--vscode-sideBarSectionHeader-background);border-bottom:1px solid var(--vscode-sideBar-border);align-items:center}
.tb .h{flex:1;font-size:11px;color:var(--vscode-descriptionForeground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}
.ci{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:3px;padding:2px 6px;font-size:11px;font-family:inherit;outline:none;min-width:0}
.ci:focus{border-color:var(--vscode-focusBorder)}
.b{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;padding:3px 10px;font-size:11px;cursor:pointer;white-space:nowrap;font-family:inherit}
.b:hover{background:var(--vscode-button-hoverBackground)}
.bd{background:var(--vscode-errorForeground)}.bd:hover{filter:brightness(1.2)}
</style></head><body>
<div class="tb"><button class="b" id="sb">▶ ${esc(vscode.l10n.t('Start'))}</button><button class="b bd" id="sp" style="display:none">■ ${esc(vscode.l10n.t('Stop'))}</button><input class="ci" id="ch" type="text" placeholder="${esc(vscode.l10n.t('agent command'))}" value="${defaultCmd}"></div>
<div id="terminal"></div>
<script>${xtermJs}
${fitAddonJs}
(function(){try{
const v=acquireVsCodeApi();
function gv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#000'}
const term=new Terminal({scrollback:200,cursorBlink:true,fontSize:13,fontFamily:getComputedStyle(document.body).fontFamily||'Consolas',
theme:{
background:gv('--vscode-terminal-background'),foreground:gv('--vscode-terminal-foreground'),
      cursor:gv('--vscode-terminal-foreground'),cursorAccent:gv('--vscode-terminal-background'),
selectionBackground:gv('--vscode-editor-selectionBackground'),
black:gv('--vscode-terminal-ansiBlack'),red:gv('--vscode-terminal-ansiRed'),green:gv('--vscode-terminal-ansiGreen'),yellow:gv('--vscode-terminal-ansiYellow'),
blue:gv('--vscode-terminal-ansiBlue'),magenta:gv('--vscode-terminal-ansiMagenta'),cyan:gv('--vscode-terminal-ansiCyan'),white:gv('--vscode-terminal-ansiWhite'),
brightBlack:gv('--vscode-terminal-ansiBrightBlack'),brightRed:gv('--vscode-terminal-ansiBrightRed'),brightGreen:gv('--vscode-terminal-ansiBrightGreen'),brightYellow:gv('--vscode-terminal-ansiBrightYellow'),
brightBlue:gv('--vscode-terminal-ansiBrightBlue'),brightMagenta:gv('--vscode-terminal-ansiBrightMagenta'),brightCyan:gv('--vscode-terminal-ansiBrightCyan'),brightWhite:gv('--vscode-terminal-ansiBrightWhite')
}});
const fit=new FitAddon.FitAddon();term.loadAddon(fit);
term.open(document.getElementById('terminal'));
fit.fit();
term.onData(d=>v.postMessage({type:'data',text:d}));
let rt;const ro=new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(()=>{fit.fit();v.postMessage({type:'resize',cols:term.cols,rows:term.rows})},100)});
ro.observe(document.getElementById('terminal'));
window.addEventListener('message',e=>{const m=e.data;
if(m.type==='s'){document.getElementById('sb').style.display='none';document.getElementById('sp').style.display='';term.focus()}
if(m.type==='x'){document.getElementById('sb').style.display='';document.getElementById('sp').style.display='none'}
if(m.type==='o'){term.write(m.t)}
if(m.type==='e')term.write('\\r\\n${esc(vscode.l10n.t('Error: {msg}', { msg: '' }))}'+m.t+'\\r\\n').then(()=>{document.getElementById('sb').style.display='';document.getElementById('sp').style.display='none'})
if(m.type==='c'){document.getElementById('ch').value=m.t}});
document.getElementById('sb').addEventListener('click',()=>v.postMessage({type:'start',cmd:document.getElementById('ch').value}));
document.getElementById('sp').addEventListener('click',()=>v.postMessage({type:'stop'}));
}catch(e){const el=document.getElementById('terminal');if(el)el.textContent='${esc(vscode.l10n.t('Init failed: {msg}', { msg: '' }))}'+e.message}})()</script></body></html>`;
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
