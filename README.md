# YourCall

> Your call, your agent.

---

You already have your own coding agent CLI — `claude`, `opencode`, `aider`, `omp`...
YourCall does not build yet another AI tool. It delivers four things inside VS Code:

1. **Agent CLI Sidebar** — run your favorite CLI agent in the VS Code sidebar, without leaving the editor
2. **AI Code Completion** (opt-in) — describe your intent and compare multiple suggestions
3. **Copy Context for AI** (right-click) — copy code location or file path, ready to feed into your agent
4. **Auto Terminal Setup** — node-pty handled out of the box

---

## Features

### ① Copy Code Context for AI (Right-click)

Select code → right-click → **Copy Code Location to AI**. Copies `relative/path:startLine-endLine` to clipboard — the format your agent CLI expects.

No selection → right-click → **Copy File Path to AI**. Copies the relative path (multi-select supported). Also works from the file explorer.

### ② Your Agent CLI Terminal

Configure your daily CLI command and run it directly in the sidebar.

- Use `claude`? → Set `yourcall.agentCommand: "claude"`
- Use `opencode`? → Set `yourcall.agentCommand: "opencode"`
- Use `omp --resume`? → Whatever you like.

Your bottom panel terminal stays yours. YourCall's sidebar terminal is for your agent.

### ③ AI Code Completion (Opt-in)

Describe your intent, generate multiple suggestions to compare. Leave it idle and it won't interfere with your flow.

### ④ Model Switching

Switch the completion model anytime via the **AI Completion: Select Model** command — no config reload needed.

### ⑤ Secure API Key Storage

API Key is stored in VS Code SecretStorage, never written to `settings.json`.

---

## Install

```bash
code --install-extension yourcall-0.1.0.vsix
```

Or `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

## Quick Start

```bash
# 1. Configure your agent CLI command
# Settings → yourcall.agentCommand → "claude"

# 2. Open sidebar → Agent CLI tab → Start
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `yourcall.agentCommand` | `""` | Your agent CLI command |
| `yourcall.apiBaseUrl` | `https://api.openai.com/v1` | API base URL (completion) |
| `yourcall.model` | `gpt-4o` | Model name |
| `yourcall.suggestionCount` | `3` | Number of suggestions |

## Commands

| Command | Description |
|---------|-------------|
| `YourCall: Open Sidebar` | Open the sidebar |
| `YourCall: Configure API Key` | Set API Key (secure storage) |
| `AI Completion: Select Model` | Switch completion model |
| `Copy Code Location to AI` | Copy selected code location (path:lines) |
| `Copy File Path to AI` | Copy relative file path (multi-select) |
| `YourCall: Install Terminal Dependencies` | Install node-pty terminal deps |

---

**Your habits, your choice. YourCall just makes VS Code work with them.**

---

# YourCall

> 你的呼唤，你的代理。

---

**你已经有了自己习惯的 Coding Agent CLI（claude、opencode、aider、omp……）。**
**YourCall 不做另一套 AI 工具——它在 VS Code 里做好四件事：**

1. **Agent CLI 侧边栏** — 在侧边栏内运行你习惯的 CLI Agent，不离开编辑器
2. **AI 代码补全**（可选）— 输入意图，对比多个方案
3. **右键复制上下文给 AI** — 复制代码位置或文件路径，直接喂给 Agent
4. **终端依赖自动管理** — node-pty 开箱即用

---

## 核心功能

### ① 快速复制代码上下文给 AI（右键菜单）

选中代码 → 右键 → **Copy Code Location to AI**，自动复制 `相对路径:行号范围` 到剪贴板，格式和 Agent CLI 直接对齐。

无选中时 → 右键 → **Copy File Path to AI**，复制文件相对路径（支持多选）。资源管理器中同样可用。

### ② 你的 Agent CLI 终端

配置你每天在用的 CLI 命令，侧边栏内直接运行。

- 你习惯 `claude`？→ 配置 `yourcall.agentCommand: "claude"`
- 你用 `opencode`？→ 配置 `yourcall.agentCommand: "opencode"`
- 你用 `omp --resume`？→ 配就是了

VS Code 底部面板的终端归终端，YourCall 的侧边栏终端归你。

### ③ 代码补全（你想要时才用）

输入意图，生成多个方案对比。不需要就放着，不干扰你的工作流。

### ④ AI 模型切换

随时通过命令 **AI Completion: Select Model** 切换补全使用的模型，无需改配置重启。

### ⑤ API Key 安全存储

API Key 存入 VS Code SecretStorage，不落盘到 settings.json。

---

## 安装

```bash
code --install-extension yourcall-0.1.0.vsix
```

或 `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

## 快速开始

```bash
# 1. 配置你的 Agent CLI
# 设置 → yourcall.agentCommand → "claude"

# 2. 打开侧边栏 → Agent CLI 标签 → 启动
```

## 配置

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `yourcall.agentCommand` | `""` | 你的 Agent CLI 命令 |
| `yourcall.apiBaseUrl` | `https://api.openai.com/v1` | API 地址（AI 补全用） |
| `yourcall.model` | `gpt-4o` | 模型名 |
| `yourcall.suggestionCount` | `3` | 补全方案数 |

## 命令

| 命令 | 说明 |
|------|------|
| `YourCall: Open Sidebar` | 打开侧边栏 |
| `YourCall: Configure API Key` | 设置 API Key（安全存储） |
| `AI Completion: Select Model` | 切换补全模型 |
| `Copy Code Location to AI` | 复制选中代码位置（路径:起止行） |
| `Copy File Path to AI` | 复制文件相对路径（支持多选） |
| `YourCall: Install Terminal Dependencies` | 安装终端依赖（node-pty） |

---

**你的习惯最优。YourCall 只是让它在 VS Code 里更顺手。**