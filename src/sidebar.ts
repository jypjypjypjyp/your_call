import { Suggestion } from './types';
import * as vscode from 'vscode';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CC = ['#4fc3f7', '#81c784', '#ffb74d'];

function card(s: Suggestion, i: number): string {
  const d = s.diff.split('\n').map(l => {
    const c = l.startsWith('+') ? 'da' : l.startsWith('-') ? 'dd' : l.startsWith('@@') ? 'dh' : '';
    return `<div class="l${c ? ' ' + c : ''}"><span class="m">${c === 'da' ? '+' : c === 'dd' ? '-' : ' '}</span><span class="c">${esc(c === 'dh' ? l : l.replace(/^[+-]/, ''))}</span></div>`;
  }).join('');
  return `<div class="cd" data-i="${i}"><div class="h"><div class="t" style="border-left:3px solid ${CC[i % 3]}">${esc(s.title)}</div><button class="b" data-i="${i}">${esc(vscode.l10n.t('Apply'))}</button><button class="b bs" data-i="${i}">${esc(vscode.l10n.t('Optimize'))}</button></div><div class="de">${esc(s.description)}</div><div class="df">${d}</div></div>`;
}

export function getSidebarHtml(su: Suggestion[], lo: boolean, er: string, mo = '', st = false): string {
  const c = st
    ? `<div class="sa"><div class="ss" id="srs" style="display:none"><div class="sl sg">${esc(vscode.l10n.t('Thinking'))}</div><div class="sx" id="sr"></div></div><div class="ss"><div class="sl sb">${esc(vscode.l10n.t('Output'))}</div><div class="sx" id="sc"></div></div><div class="sss" id="sss">${esc(vscode.l10n.t('Generating...'))}</div></div>`
    : lo ? `<div class="ld">${esc(vscode.l10n.t('Analyzing code...'))}</div>`
    : er ? `<div class="er">${esc(er)}<br><span class="b rt" id="rt">${esc(vscode.l10n.t('Retry'))}</span></div>`
    : su.map((s, i) => card(s, i)).join('');

  return `<!DOCTYPE html><html><head><style>
body{box-sizing:border-box;font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size,13px);background:var(--vscode-sideBar-background);color:var(--vscode-sideBar-foreground);padding:8px;margin:0;display:flex;flex-direction:column;height:100vh}
.cd{background:var(--vscode-sideBar-background);border:1px solid var(--vscode-sideBar-border);border-radius:4px;margin-bottom:8px;overflow:hidden;cursor:pointer}
.cd:hover{box-shadow:0 0 0 1px var(--vscode-focusBorder)}
.h{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 10px 2px}
.cd .t{font-weight:600;padding-left:6px;flex:1;color:var(--vscode-sideBarTitle-foreground)}
.de{color:var(--vscode-descriptionForeground);font-size:12px;padding:2px 10px 6px;line-height:1.5}
.b{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;padding:2px 8px;font-size:11px;cursor:pointer;white-space:nowrap;font-family:inherit}
.b:hover{background:var(--vscode-button-hoverBackground)}
.df{background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);border:1px solid var(--vscode-sideBar-border);border-radius:3px;font-family:inherit;font-size:11px;line-height:1.6;margin:0 8px 8px;overflow-x:auto}
.l{display:flex}
.l .m{width:16px;text-align:center;flex-shrink:0;font-weight:700;color:var(--vscode-descriptionForeground)}
.l .c{flex:1;white-space:pre;padding-right:8px}
.da{background:rgba(0,200,80,.12)}.da .m{color:var(--vscode-terminal-ansiGreen)}.da .c{color:var(--vscode-terminal-ansiGreen)}
.dd{background:rgba(200,0,0,.12)}.dd .m{color:var(--vscode-terminal-ansiRed)}.dd .c{color:var(--vscode-terminal-ansiRed)}
.dh{background:var(--vscode-editor-background)}.dh .m,.dh .c{color:var(--vscode-descriptionForeground);font-style:italic}
.ia{display:flex;gap:6px;padding:4px 0}
.ia input{flex:1;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-radius:3px;padding:6px 8px;color:var(--vscode-input-foreground);font-family:inherit;font-size:12px;outline:none}
.ia input:focus{border-color:var(--vscode-focusBorder)}
.ia input::placeholder{color:var(--vscode-input-placeholderForeground)}
.ia .b{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;padding:6px 12px;font-family:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.bs{background:var(--vscode-errorForeground)}.bs:hover{background:var(--vscode-errorForeground)}
.sx{font-family:inherit;font-size:11px;line-height:1.6;padding:8px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);border-radius:3px;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow-y:auto}
.sl{font-size:11px;font-weight:600;padding:4px 8px;border-radius:3px;margin-bottom:4px}
.sg{background:var(--vscode-editor-background);color:var(--vscode-descriptionForeground)}
.sb{background:var(--vscode-editor-background);color:var(--vscode-descriptionForeground)}
.sss{font-size:11px;color:var(--vscode-descriptionForeground);padding:4px 8px;text-align:center}
.ld{text-align:center;padding:40px 20px;color:var(--vscode-descriptionForeground)}
.er{text-align:center;padding:20px;color:var(--vscode-descriptionForeground);font-size:12px}
.rt{display:inline-block;margin-top:8px}
.hi{font-size:11px;color:var(--vscode-descriptionForeground);padding:4px 2px 6px;border-bottom:1px solid var(--vscode-sideBar-border);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
.ms{cursor:pointer;font-size:11px}.ms:hover{background:var(--vscode-list-hoverBackground)}
.sts{font-size:11px;color:var(--vscode-descriptionForeground);padding:4px 2px;border-top:1px solid var(--vscode-sideBar-border);margin-top:4px}
#c{flex:1;overflow-y:auto;min-height:0}
</style></head><body>
<div class="hi">${mo ? `<span class="ms" id="ms">${esc(vscode.l10n.t('Model: '))}${esc(mo)} ▾</span>` : ''}</div>
<div id="c">${c}</div>
<div class="ia"><input id="ii" placeholder="${esc(vscode.l10n.t('Enter intent (optional)'))}"/><button class="b" id="gb" style="${st?'display:none':''}">${esc(vscode.l10n.t('Generate'))}</button><button class="b bs" id="sb" style="${st?'':'display:none'}">${esc(vscode.l10n.t('Stop'))}</button></div>
<div class="sts" id="st"></div>
<script>
(function(){const v=acquireVsCodeApi();let su=${JSON.stringify(su)};
document.getElementById('c').addEventListener('click',e=>{const c=e.target.closest('.cd');if(!c)return;const i=parseInt(c.dataset.i);if(e.target.classList.contains('bs')){v.postMessage({type:'resetSuggestion',suggestion:su[i]})}else if(e.target.classList.contains('b')){v.postMessage({type:'applySuggestion',suggestion:su[i]})}else{v.postMessage({type:'viewDiff',suggestion:su[i]})}});
document.getElementById('gb').addEventListener('click',()=>{v.postMessage({type:'regenerate',userIntent:document.getElementById('ii').value});document.getElementById('gb').style.display='none';document.getElementById('sb').style.display=''});
document.getElementById('sb').addEventListener('click',()=>{v.postMessage({type:'stop'});document.getElementById('sb').style.display='none';document.getElementById('gb').style.display=''});
document.getElementById('ii').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('gb').click()});
const rt=document.getElementById('rt');if(rt)rt.addEventListener('click',()=>{v.postMessage({type:'regenerate',userIntent:document.getElementById('ii').value})});
const ms=document.getElementById('ms');if(ms)ms.addEventListener('click',()=>{v.postMessage({type:'selectModel'})});
window.addEventListener('message',e=>{const m=e.data;
if(m.type==='modelChanged'&&m.model){const el=document.getElementById('ms');if(el)el.textContent='${esc(vscode.l10n.t('Model: '))}'+m.model+' ▾'}
if(m.type==='streamChunk'){const rs=document.getElementById('srs'),re=document.getElementById('sr'),ce=document.getElementById('sc');if(m.reasoning&&rs){rs.style.display='';if(re)re.textContent=m.reasoning}if(ce){ce.textContent=m.content;ce.scrollTop=ce.scrollHeight}}
if(m.type==='streamEnd'){document.getElementById('sb').style.display='none';document.getElementById('gb').style.display='';const se=document.getElementById('sss');if(se)se.textContent='${esc(vscode.l10n.t('Generation complete'))}'}})})()
</script></body></html>`;
}
