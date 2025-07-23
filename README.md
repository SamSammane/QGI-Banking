# Mine AI

![Mine AI Screenshot](./docs/assets/qwen-screenshot.png)

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

Or you can install it from source:

```bash
git clone https://github.com/your-org/mine-ai.git
cd mine-ai
npm install
npm install -g .
```

### API Configuration

#### Option 1: Mine AI API (Default)
Set your Mine AI API key (In Mine AI project, you can also set your API key in `.env` file):

```bash
export MINEAI_API_KEY="your_api_key_here"
export MINEAI_BASE_URL="your_api_base_url_here"
export OPENAI_MODEL="moonshotai/Kimi-K2-Instruct"
```

#### Option 2: HuggingFace Kimi K2 with Proxy Platform
For using HuggingFace Kimi K2 model through HuggingFace Router:

```bash
export HUGGINGFACE_API_KEY="your_huggingface_api_key"
export HUGGINGFACE_BASE_URL="https://router.huggingface.co/v1"
export OPENAI_MODEL="moonshotai/Kimi-K2-Instruct:novita"
```

Available providers for Kimi K2:
- `moonshotai/Kimi-K2-Instruct:novita`
- `moonshotai/Kimi-K2-Instruct:fireworks-ai`
- `moonshotai/Kimi-K2-Instruct:together`
- `moonshotai/Kimi-K2-Instruct:groq`

Or use a custom proxy platform directly:

```bash
export PROXY_API_KEY="your_proxy_api_key"
export PROXY_BASE_URL="your_proxy_platform_base_url"
export OPENAI_MODEL="moonshotai/Kimi-K2-Instruct"
```

## Usage Examples

### Explore Codebases

```sh
cd your-project/
mineai
> Describe the main pieces of this system's architecture
```

### Code Development

```sh
> Refactor this function to improve readability and performance
```

### Automate Workflows

```sh
> Analyze git commits from the last 7 days, grouped by feature and team member
```

```sh
> Convert all images in this directory to PNG format
```

## Popular Tasks

### Understand New Codebases

```text
> What are the core business logic components?
> What security mechanisms are in place?
> How does the data flow work?
```

### Code Refactoring & Optimization

```text
> What parts of this module can be optimized?
> Help me refactor this class to follow better design patterns
> Add proper error handling and logging
```

### Documentation & Testing

```text
> Generate comprehensive JSDoc comments for this function
> Write unit tests for this component
> Create API documentation
```

## Benchmark Results

### Terminal-Bench

| Agent     | Model              | Accuracy |
|-----------|--------------------|----------|
| Mine AI | moonshotai/Kimi-K2-Instruct | 37.5     |

## Project Structure

```
mine-ai/
├── packages/           # Core packages
├── docs/              # Documentation
├── examples/          # Example code
└── tests/            # Test files
```

## Development & Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) to learn how to contribute to the project.

## Troubleshooting

If you encounter issues, check the [troubleshooting guide](docs/troubleshooting.md).

## Acknowledgments

This project is based on [Google Gemini CLI](https://github.com/google-gemini/gemini-cli). We acknowledge and appreciate the excellent work of the Gemini CLI team. Our main contribution focuses on parser-level adaptations to better support Kimi-K2 models.

## License

[LICENSE](./LICENSE)
