import { Suggestion } from './types';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cardHtml(s: Suggestion, index: number): string {
  const colors = ['#4fc3f7', '#81c784', '#ffb74d'];
  const color = colors[index % 3];
  const diffLines = s.diff.split('\n').map(line => {
    if (line.startsWith('+')) return `<div class="dl da"><span class="m">+</span><span class="c">${escapeHtml(line.slice(1))}</span></div>`;
    if (line.startsWith('-')) return `<div class="dl dd"><span class="m">-</span><span class="c">${escapeHtml(line.slice(1))}</span></div>`;
    if (line.startsWith('@@')) return `<div class="dl dh"><span class="m"> </span><span class="c">${escapeHtml(line)}</span></div>`;
    return `<div class="dl"><span class="m"> </span><span class="c">${escapeHtml(line)}</span></div>`;
  }).join('');

  return `
  <div class="card" data-index="${index}">
    <div class="ch">
      <div class="ct" style="border-left:3px solid ${color}">
        <span class="ci"></span>${escapeHtml(s.title)}
      </div>
      <button class="apply-btn" data-index="${index}">应用</button>
    </div>
    <div class="cd">${escapeHtml(s.description)}</div>
    <div class="diff">${diffLines}</div>
  </div>`;
}

export function getSidebarHtml(suggestions: Suggestion[], loading: boolean, error: string): string {
  const cards = loading
    ? '<div class="loading">正在分析代码...</div>'
    : error
      ? `<div class="error">${escapeHtml(error)}<br><span class="retry" id="retryBtn">重新尝试</span></div>`
      : suggestions.map((s, i) => cardHtml(s, i)).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1e1e1e;color:#ccc;padding:8px;font-size:13px;}
.card{background:#2d2d2d;border-radius:6px;margin-bottom:8px;overflow:hidden;cursor:pointer;transition:transform .1s,box-shadow .1s;}
.card:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.4);}
.ch{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 10px 2px;}
.ct{font-weight:600;font-size:13px;padding-left:6px;flex:1;}
.ci{display:inline-block;width:3px;height:14px;border-radius:2px;margin-right:6px;vertical-align:middle;}
.cd{color:#888;font-size:12px;padding:2px 10px 6px;line-height:1.5;}
.apply-btn{background:#0e639c;color:#fff;border:none;border-radius:3px;padding:2px 8px;font-size:11px;cursor:pointer;}
.apply-btn:hover{background:#1177bb;}
.diff{margin:0 8px 8px;background:#1a1a1a;border-radius:4px;border:1px solid #333;font-family:Consolas,'Fira Code',monospace;font-size:11px;line-height:1.6;overflow-x:auto;}
.dl{display:flex;}
.dl .m{width:16px;text-align:center;flex-shrink:0;font-weight:bold;}
.dl .c{flex:1;white-space:pre;padding-right:8px;}
.da{background:#1a3a1a;}.da .m{color:#81c784;}.da .c{color:#a3d9a3;}
.dd{background:#3a1a1a;}.dd .m{color:#f44747;}.dd .c{color:#f48787;}
.dh{background:#252538;}.dh .m,.dh .c{color:#777;font-style:italic;}
.input-area{display:flex;gap:6px;padding:4px 0;}
.input-area input{flex:1;background:#3c3c3c;border:1px solid #555;border-radius:3px;padding:6px 8px;color:#ccc;font-size:12px;outline:none;}
.input-area input:focus{border-color:#0e639c;}
.input-area input::placeholder{color:#666;}
.input-area button{background:#0e639c;color:#fff;border:none;border-radius:3px;padding:6px 12px;font-size:12px;cursor:pointer;white-space:nowrap;}
.input-area button:hover{background:#1177bb;}
.loading{text-align:center;padding:40px 20px;color:#888;}
.error{text-align:center;padding:20px;color:#f48787;font-size:12px;}
.error .retry{color:#4fc3f7;cursor:pointer;text-decoration:underline;margin-top:8px;display:inline-block;}
.status{font-size:11px;color:#666;padding:4px 2px;border-top:1px solid #333;margin-top:4px;display:flex;justify-content:space-between;}
.status .kbd{color:#888;}
.header-info{font-size:11px;color:#666;padding:4px 2px 6px;border-bottom:1px solid #333;margin-bottom:6px;}
</style>
</head>
<body>
  <div id="app">
    <div class="header-info" id="info"></div>
    <div id="cards">${cards}</div>
    <div class="input-area">
      <input type="text" id="intentInput" placeholder="输入补充意图，如：移动端适配、性能优化..." />
      <button id="regenerateBtn">重新生成</button>
    </div>
    <div class="status">
      <span id="statusText"></span>
      <span class="kbd">Ctrl+Shift+Space</span>
    </div>
  </div>

<script>
(function() {
  const vscode = acquireVsCodeApi();
  let suggestions = ${JSON.stringify(suggestions)};

  document.getElementById('cards').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const idx = parseInt(card.dataset.index);
    if (e.target.classList.contains('apply-btn')) {
      vscode.postMessage({ type: 'applySuggestion', suggestion: suggestions[idx] });
    } else {
      vscode.postMessage({ type: 'viewDiff', suggestion: suggestions[idx] });
    }
  });

  document.getElementById('regenerateBtn').addEventListener('click', () => {
    const input = document.getElementById('intentInput');
    vscode.postMessage({ type: 'regenerate', userIntent: input.value });
  });

  document.getElementById('intentInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('regenerateBtn').click();
    }
  });

  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const input = document.getElementById('intentInput');
      vscode.postMessage({ type: 'regenerate', userIntent: input.value });
    });
  }

  vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
