# YourCall

**极简 Coding Agent VS Code 扩展。不为改变你的习惯，只为服务你的 Agent CLI。**

---

你已经有自己习惯的 Coding Agent CLI（claude、opencode、aider、omp……）。
YourCall 不做另一套 AI 功能——它只做两件事：

1. **Agent CLI 侧边栏** — 在 VS Code 侧边栏内运行你习惯的 CLI Agent，不离开编辑器
2. **AI 代码补全**（可选）— 当你想多个方案对比时，输入意图生成补全建议

---

## 核心功能

### ① 你的 Agent CLI 终端
配置你每天在用的 CLI 命令，侧边栏内直接运行。

- 你习惯 `claude`？→ 配置 `aiCompletion.agentCommand: "claude"`
- 你用 `opencode`？→ 配置 `aiCompletion.agentCommand: "opencode"`
- 你用 `omp --resume`？→ 配就是了

VS Code 底部面板的终端归终端，YourCall 的侧边栏终端归你。

### ② 代码补全（你想要时才用）
输入意图，生成多个方案对比。不需要就放着，不干扰你的工作流。

---

## 安装

```bash
code --install-extension yourcall-0.1.0.vsix
```

或 `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

## 快速开始

```bash
# 1. 配置你的 Agent CLI
# 设置 → aiCompletion.agentCommand → "claude"

# 2. 打开侧边栏 → Agent CLI 标签 → 启动
```

## 配置

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `aiCompletion.agentCommand` | `""` | 你的 Agent CLI 命令 |
| `aiCompletion.apiBaseUrl` | `https://api.openai.com/v1` | API 地址（AI 补全用） |
| `aiCompletion.model` | `gpt-4o` | 模型名 |
| `aiCompletion.suggestionCount` | `3` | 补全方案数 |

## 命令

| 命令 | 说明 |
|------|------|
| `YourCall: Open Sidebar` | 打开侧边栏 |
| `YourCall: Configure API Key` | 设置 API Key |

---

**你的习惯最优。YourCall 只是让它在 VS Code 里更顺手。**
