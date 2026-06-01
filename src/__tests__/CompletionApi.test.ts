import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, parseResponse } from '../CompletionApi';
import { ContextDocument } from '../types';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
    }),
  },
}));

describe('parseResponse', () => {
  it('从 markdown 代码块提取 JSON', () => {
    const input = 'some text\n```json\n[{"title": "方案1", "description": "描述", "diff": "+新增行"}\n]\n```';
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('方案1');
    expect(result[0].diff).toBe('+新增行');
  });

  it('纯 JSON 格式也能解析', () => {
    const input = '[{"title":"A","description":"B","diff":"C"}]';
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  it('缺少字段时使用默认值', () => {
    const input = '[{"diff": "+x"}]';
    const result = parseResponse(input);
    expect(result[0].title).toBe('方案 1');
    expect(result[0].description).toBe('');
  });

  it('空数组抛异常', () => {
    expect(() => parseResponse('[]')).toThrow('空数组');
  });

  it('无 JSON 数组抛异常', () => {
    expect(() => parseResponse('没有数组')).toThrow('未找到 JSON 数组');
  });
});

describe('buildPrompt', () => {
  const mockDoc: ContextDocument = {
    fileName: '/test.ts',
    languageId: 'typescript',
    content: 'abc',
    isActive: true,
    cursorLine: 5,
    nearCursorCode: 'abc',
  };

  it('包含光标位置和文件信息', () => {
    const result = buildPrompt([mockDoc], '/test.ts', 5, '', 3);
    expect(result).toContain('/test.ts:5');
    expect(result).toContain('3 个方案');
  });

  it('包含用户意图', () => {
    const result = buildPrompt([mockDoc], '/test.ts', 5, '移动端适配', 3);
    expect(result).toContain('移动端适配');
  });
});
