import * as vscode from 'vscode';
import { ContextDocument, Suggestion } from './types';

export function buildPrompt(
  documents: ContextDocument[],
  cursorFile: string,
  cursorLine: number,
  userIntent: string,
  suggestionCount: number
): string {
  let prompt = `光标位置: ${cursorFile}:${cursorLine}\n\n`;

  // Cursor-nearby code (modifiable range)
  const activeDoc = documents.find(d => d.isActive);
  if (activeDoc) {
    prompt += `光标附近代码（可修改范围）：\n`;
    prompt += `━━ ${activeDoc.fileName} :${Math.max(0, cursorLine - 31)}-${cursorLine + 30} ━━\n`;
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
  prompt += `- 修改范围严格限制在光标附近 ±30 行\n`;
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

export async function fetchSuggestions(
  documents: ContextDocument[],
  cursorFile: string,
  cursorLine: number,
  userIntent: string,
  apiKey: string
): Promise<Suggestion[]> {
  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  const config = vscode.workspace.getConfiguration('aiCompletion');
  const apiBaseUrl = config.get<string>('apiBaseUrl', 'https://api.openai.com/v1');
  const model = config.get<string>('model', 'gpt-4o-mini');
  const suggestionCount = config.get<number>('suggestionCount', 3);
  const prompt = buildPrompt(documents, cursorFile, cursorLine, userIntent, suggestionCount);

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
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
  });

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
