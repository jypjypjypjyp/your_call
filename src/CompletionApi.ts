import * as vscode from 'vscode';
import { ContextDocument, Suggestion } from './types';

export function buildPrompt(
  documents: ContextDocument[],
  cursorFile: string,
  cursorLine: number,
  userIntent: string,
  suggestionCount: number,
  selectionStart?: number,
  selectionEnd?: number
): string {
  const rangeDesc = (selectionStart && selectionEnd && (selectionStart !== Math.max(1, cursorLine - 30) || selectionEnd !== cursorLine + 30))
    ? `选中范围: ${cursorFile}:${selectionStart}-${selectionEnd}`
    : `光标位置: ${cursorFile}:${cursorLine}`;
  let prompt = `${rangeDesc}\n\n`;

  // Cursor-nearby code (modifiable range)
  const activeDoc = documents.find(d => d.isActive);
  if (activeDoc) {
    if (selectionStart && selectionEnd && (selectionStart !== Math.max(1, cursorLine - 30) || selectionEnd !== cursorLine + 30)) {
      prompt += `选中范围代码（可修改范围）：\n`;
      prompt += `━━ ${activeDoc.fileName} :${selectionStart}-${selectionEnd} ━━\n`;
    } else {
      prompt += `光标附近代码（可修改范围）：\n`;
      prompt += `━━ ${activeDoc.fileName} :${Math.max(0, cursorLine - 31)}-${cursorLine + 30} ━━\n`;
    }
    prompt += `${activeDoc.nearCursorCode}\n\n`;
  }

  // Other open files (read-only reference)
  const otherDocs = documents.filter(d => !d.isActive);
  if (otherDocs.length > 0) {
    prompt += `其他打开的文件（只读参考，不得修改）：\n`;
    for (const doc of otherDocs) {
      prompt += `━━ ${doc.fileName} (${doc.languageId}) ━━\n`;
      prompt += `${doc.content}\n\n`;
    }
  }

  if (userIntent) {
    prompt += `用户补充意图：${userIntent}\n\n`;
  }

  prompt += `请以 JSON 格式返回 ${suggestionCount} 个方案：\n`;
  prompt += `[\n  {\n    "title": "方案简要标题",\n    "description": "一句话描述改动内容",\n    "file": "修改所属文件名（仅当与光标文件不同时填写）",\n    "diff": "统一 diff 格式的代码改动，仅包含光标附近的修改"\n  }\n]\n`;
  prompt += `\n约束：\n`;
  prompt += `- 修改范围严格限制在指定的选中/光标范围内\n`;
  prompt += `- 不允许重写整个文件\n`;
  prompt += `- diff 格式：+ 开头为新增行，- 开头为删除行，空格开头为上下文`;

  return prompt;
}

export function parseResponse(text: string): Suggestion[] {
  const jsonMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  const start = jsonStr.indexOf('[');
  const end = jsonStr.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error('API 返回中未找到 JSON 数组');
  }
  const suggestions: Suggestion[] = JSON.parse(jsonStr.slice(start, end + 1));
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('API 返回了空数组');
  }
  return suggestions.map((s, i) => ({
    title: s.title || `方案 ${i + 1}`,
    description: s.description || '',
    file: s.file,
    diff: s.diff || '',
  }));
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function listModels(apiBaseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${apiBaseUrl.replace(/\/+$/, '')}/models`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`获取模型列表失败 (${response.status})`);
  }
  const data = await response.json() as { data: Array<{ id: string }> };
  return data.data.map(m => m.id).sort();
}


export async function fetchSuggestions(
  documents: ContextDocument[],
  cursorFile: string,
  cursorLine: number,
  userIntent: string,
  apiKey: string,
  selectionStart?: number,
  selectionEnd?: number
): Promise<Suggestion[]> {
  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  const config = vscode.workspace.getConfiguration('aiCompletion');
  const apiBaseUrl = config.get<string>('apiBaseUrl', 'https://api.openai.com/v1');
  const model = config.get<string>('model', 'gpt-4o-mini');
  const suggestionCount = config.get<number>('suggestionCount', 3);

  // Debug info
  const maskedKey = apiKey.slice(0, 8) + '...';
  vscode.window.showInformationMessage(
    `[AI Completion] URL: ${apiBaseUrl} | Model: ${model} | Key: ${maskedKey}`
  );

  if (!apiBaseUrl || !/^https?:\/\//.test(apiBaseUrl)) {
    throw new Error(`API 地址无效: ${apiBaseUrl}`);
  }

  const prompt = buildPrompt(documents, cursorFile, cursorLine, userIntent, suggestionCount, selectionStart, selectionEnd);

  // Check VS Code proxy setting
  const httpConfig = vscode.workspace.getConfiguration('http');
  const proxy = httpConfig.get<string>('proxy', '');
  const strictSSL = httpConfig.get<boolean>('proxyStrictSSL', true);

  const fullUrl = `${apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `你是一个资深代码助手。分析上下文后给出 ${suggestionCount} 个补全方案。每个方案必须是光标附近的精确局部修改，不做大规模重构。`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    const isTimeout = e instanceof DOMException && e.name === 'AbortError';
    const proxyHint = proxy ? `(已配置代理: ${proxy})` : '(未配置代理，如在公司网络请设置 http.proxy)';
    if (isTimeout) {
      throw new Error(`API 请求超时（30s）: ${fullUrl} ${proxyHint}`);
    }
    throw new Error(`网络请求失败: ${fullUrl}\n${e instanceof Error ? e.message : String(e)}\n${proxyHint}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API 错误 (${response.status}): ${err}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('API 返回为空');
  }

  return parseResponse(text);
}

export async function streamSuggestions(
  documents: ContextDocument[],
  cursorFile: string,
  cursorLine: number,
  userIntent: string,
  apiKey: string,
  onChunk: (reasoning: string, content: string) => void,
  selectionStart?: number,
  selectionEnd?: number
): Promise<Suggestion[]> {
  if (!apiKey) throw new Error('API Key 未配置');

  const config = vscode.workspace.getConfiguration('aiCompletion');
  const apiBaseUrl = config.get<string>('apiBaseUrl', 'https://api.openai.com/v1');
  const model = config.get<string>('model', 'gpt-4o-mini');
  const suggestionCount = config.get<number>('suggestionCount', 3);

  if (!apiBaseUrl || !/^https?:\/\//.test(apiBaseUrl)) {
    throw new Error(`API 地址无效: ${apiBaseUrl}`);
  }

  const prompt = buildPrompt(documents, cursorFile, cursorLine, userIntent, suggestionCount, selectionStart, selectionEnd);
  const fullUrl = `${apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

  const httpConfig = vscode.workspace.getConfiguration('http');
  const proxy = httpConfig.get<string>('proxy', '');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s for streaming

  let fullContent = '';
  let fullReasoning = '';

  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `你是一个资深代码助手。分析上下文后给出 ${suggestionCount} 个补全方案。每个方案必须是光标附近的精确局部修改，不做大规模重构。`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API 错误 (${response.status}): ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('响应体不可读');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.reasoning_content) {
            fullReasoning += delta.reasoning_content;
          }
          if (delta.content) {
            fullContent += delta.content;
          }
          onChunk(fullReasoning, fullContent);
        } catch { /* skip malformed JSON lines */ }
      }
    }

  } catch (e: unknown) {
    const isTimeout = e instanceof DOMException && e.name === 'AbortError';
    const proxyHint = proxy ? `(已配置代理: ${proxy})` : '(未配置代理，如在公司网络请设置 http.proxy)';
    if (isTimeout) {
      throw new Error(`API 请求超时（60s）: ${fullUrl} ${proxyHint}`);
    }
    throw new Error(`网络请求失败: ${fullUrl}\n${e instanceof Error ? e.message : String(e)}\n${proxyHint}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!fullContent.trim()) throw new Error('API 返回为空');
  return parseResponse(fullContent);
}
