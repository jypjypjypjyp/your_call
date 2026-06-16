(() => {
  try {
    const C = window.__agentConfig;
    const v = acquireVsCodeApi();

    function gv(n) {
      return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#000';
    }

    const term = new Terminal({
      scrollback: 1000,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: getComputedStyle(document.body).fontFamily || 'Consolas',
      theme: {
        background: gv('--vscode-terminal-background'),
        foreground: gv('--vscode-terminal-foreground'),
        cursor: gv('--vscode-terminal-foreground'),
        cursorAccent: gv('--vscode-terminal-background'),
        selectionBackground: gv('--vscode-terminal-foreground'),
        selectionForeground: gv('--vscode-terminal-background'),
        black: gv('--vscode-terminal-ansiBlack'),
        red: gv('--vscode-terminal-ansiRed'),
        green: gv('--vscode-terminal-ansiGreen'),
        yellow: gv('--vscode-terminal-ansiYellow'),
        blue: gv('--vscode-terminal-ansiBlue'),
        magenta: gv('--vscode-terminal-ansiMagenta'),
        cyan: gv('--vscode-terminal-ansiCyan'),
        white: gv('--vscode-terminal-ansiWhite'),
        brightBlack: gv('--vscode-terminal-ansiBrightBlack'),
        brightRed: gv('--vscode-terminal-ansiBrightRed'),
        brightGreen: gv('--vscode-terminal-ansiBrightGreen'),
        brightYellow: gv('--vscode-terminal-ansiBrightYellow'),
        brightBlue: gv('--vscode-terminal-ansiBrightBlue'),
        brightMagenta: gv('--vscode-terminal-ansiBrightMagenta'),
        brightCyan: gv('--vscode-terminal-ansiBrightCyan'),
        brightWhite: gv('--vscode-terminal-ansiBrightWhite')
      }
    });

    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(document.getElementById('terminal'));

    // Copy: Ctrl+C with selection → copy, without → pass to shell (SIGINT)
    term.attachCustomKeyEventHandler((e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        const s = term.getSelection();
        if (s) {
          navigator.clipboard.writeText(s).catch(() => {});
          return false;
        }
        return true;
      }
      return true;
    });

    // Path navigation: register link provider for file paths
    term.registerLinkProvider({
      provideLinks(y, callback) {
        const bufferLine = term.buffer.active.getLine(y - 1);
        if (!bufferLine) { callback([]); return; }
        const lineText = bufferLine.translateToString(true);
        const regex = /([^\s:]+\.\w+)(?::(\d+))?(?::(\d+))?/g;
        const links = [];
        let match;
        while ((match = regex.exec(lineText)) !== null) {
          links.push({
            text: match[0],
            range: {
              start: { x: match.index + 1, y },
              end: { x: match.index + match[0].length, y }
            },
            decoration: {
              pointerCursor: 'pointer',
              hoverMessage: match[0]
            },
            activate(event, text) {
              const parts = text.split(':');
              const filePath = parts[0];
              const line = parts[1] ? parseInt(parts[1]) : undefined;
              const column = parts[2] ? parseInt(parts[2]) : undefined;
              v.postMessage({ type: 'openFile', path: filePath, line: line, column: column });
            },
            hover(event, text) {},
            leave(event, text) {}
          });
        }
        callback(links);
      }
    });

    fit.fit();
    term.onData(d => v.postMessage({ type: 'data', text: d }));

    let rt;
    const ro = new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        fit.fit();
        v.postMessage({ type: 'resize', cols: term.cols, rows: term.rows });
      }, 100);
    });
    ro.observe(document.getElementById('terminal'));

    window.addEventListener('message', e => {
      const m = e.data;
      if (m.type === 's') {
        document.getElementById('sb').style.display = 'none';
        document.getElementById('sp').style.display = '';
        term.focus();
      }
      if (m.type === 'x') {
        document.getElementById('sb').style.display = '';
        document.getElementById('sp').style.display = 'none';
      }
      if (m.type === 'o') { term.write(m.t); }
      if (m.type === 'e') {
        term.write('\r\n' + C.errorMsg + m.t + '\r\n').then(() => {
          document.getElementById('sb').style.display = '';
          document.getElementById('sp').style.display = 'none';
        });
      }
      if (m.type === 'c') { document.getElementById('ch').value = m.t; }
    });

    document.getElementById('sb').addEventListener('click', () =>
      v.postMessage({ type: 'start', cmd: document.getElementById('ch').value })
    );
    document.getElementById('sp').addEventListener('click', () =>
      v.postMessage({ type: 'stop' })
    );

  } catch (e) {
    const C = window.__agentConfig || {};
    const el = document.getElementById('terminal');
    if (el) el.textContent = (C.initFailedMsg || 'Init failed: ') + e.message;
  }
})();