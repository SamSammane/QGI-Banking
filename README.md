# Mine AI

![Mine AI Screenshot](./docs/assets/mine-screenshot.png)

Mine AI is a command-line AI workflow tool adapted from [**Gemini CLI**](https://github.com/google-gemini/gemini-cli)(Please refer to [this document](./README.gemini.md) for more details), optimized for [Kimi-K2](https://huggingface.co/moonshotai/Kimi-K2-Instruct) models with enhanced parser support & tool support.

## Key Features

- **Code Understanding & Editing** - Query and edit large codebases beyond traditional context window limits
- **Workflow Automation** - Automate operational tasks like handling pull requests and complex rebases
- **Enhanced Parser** - Adapted parser specifically optimized for Kimi-K2 models

## Quick Start

### Prerequisites

Ensure you have [Node.js version 20](https://nodejs.org/en/download) or higher installed.

```bash
curl -qL https://www.npmjs.com/install.sh | sh
```

### Installation

```bash
npm install -g @mine-ai/mine-ai
mineai --version
```

Then run from anywhere:

```bash
mineai
```



### API Configuration

要配置 API，请访问我们的平台获取您的 API 密钥、基础 URL 和模型信息。

## Node Operation Examples (TDB)

TDB

## Benchmark Results

### Terminal-Bench

| Agent     | Model              | Accuracy |
|-----------|--------------------|----------|
| Mine AI | moonshotai/Kimi-K2-Instruct | 37.5     |



## License

[LICENSE](./LICENSE)
