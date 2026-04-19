<div align="center">

# Marquis Markdown Mark 1

<img src="./MM.png" alt="MarquisMark" width="400" />

</div>

A local desktop markdown editor built for authoring prompts for Claude and GPT models. Think Typora, but purpose-built for prompt engineering.

## Features

- **WYSIWYG Markdown** — Formatting renders inline as you type (headings, bold, lists, code blocks, etc.)
- **XML Tag Auto-complete** — Type `<` to get suggestions for common Claude prompting tags (`<instructions>`, `<example>`, `<thinking>`, etc.)
- **XML Tag Auto-close & Auto-indent** — Tags are automatically closed and content is indented
- **Sandboxed Filesystem** — Per-project workspaces with tightly controlled file access enforced at the Rust layer
- **Runs Locally** — No cloud services, no telemetry. Your prompts stay on your machine.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | [Tauri v2](https://v2.tauri.app/) (Rust backend, system webview) |
| Frontend | React 19 + TypeScript + Vite |
| Editor | [TipTap v2](https://tiptap.dev/) (ProseMirror-based WYSIWYG) |
| State | Zustand |

## Prerequisites

- [Rust](https://rustup.rs/) (1.77+)
- [Node.js](https://nodejs.org/) (20+)
- npm

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode (hot-reloading frontend + Rust backend)
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
marquisMark/
├── src/                    # React frontend
│   ├── components/
│   │   ├── editor/         # TipTap editor + XML tag UI
│   │   ├── sidebar/        # File tree + workspace picker
│   │   └── layout/         # App shell, title bar, status bar
│   ├── extensions/         # Custom TipTap extensions (XML tags, autocomplete)
│   ├── store/              # Zustand state management
│   ├── services/           # Tauri invoke wrappers
│   └── lib/                # XML tag definitions, constants
│
└── src-tauri/              # Rust backend
    └── src/
        ├── commands/       # Tauri commands (filesystem, workspace)
        ├── workspace/      # Workspace manager + config persistence
        └── sandbox/        # Path validation + traversal protection
```

## Security Model

All filesystem access goes through custom Rust commands that enforce workspace sandboxing. The frontend has **no direct filesystem permissions** — every path is canonicalized and validated against the workspace root before any I/O operation. This prevents path traversal attacks and restricts access to user-approved directories only.

## License

MIT
