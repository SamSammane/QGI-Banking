// Declarative registry of the sibling reference implementations this CLI can
// drive. Nothing here vendors or forks another repository: each entry records
// how to reach a service that is deployed separately, plus whether Mine AI has
// an implemented adapter for it or has only declared the integration point.
//
// role:
//   symbolic — deterministic, reproducible; usable as a verification oracle.
//   neural   — learned or generative; its output is a claim, not a fact.
//
// status:
//   implemented — an adapter in this directory can call it today.
//   declared    — the integration point is recorded but not yet wired up.

export const ADAPTERS = [
  {
    id: 'watchman',
    repo: 'moov-io/watchman',
    kind: 'http',
    role: 'symbolic',
    capability: 'Sanctions / PEP entity screening via deterministic name and address matching.',
    env: 'MINEAI_WATCHMAN_URL',
    defaultUrl: 'http://localhost:8084',
    probePath: '/v2/listinfo',
    status: 'implemented',
    notes:
      'Search is GET /v2/search?name=. The same server also speaks MCP at /mcp (tool: search_entities).',
  },
  {
    id: 'kyc-analyst',
    repo: 'vyayasan/kyc-analyst',
    kind: 'agent',
    role: 'symbolic',
    capability: 'Deterministic four-factor customer risk score (FATF / EBA / FinCEN weighting).',
    env: null,
    defaultUrl: null,
    probePath: null,
    status: 'declared',
    notes:
      'Ships as a Claude Code / Cowork plugin: prompt commands, not a callable binary. Its scoring ' +
      'weights live in skills/risk-assessment/SKILL.md and are meant to be firm-calibrated, so this ' +
      'CLI deliberately does not re-implement them. Integration runs the other way: that plugin ' +
      'consumes `mineai mcp serve`.',
  },
  {
    id: 'fraud-detection',
    repo: 'NVIDIA financial-fraud-detection blueprint',
    kind: 'process',
    role: 'neural',
    capability: 'TabFormer graph / gradient-boosted fraud inference served through Triton.',
    env: 'MINEAI_FRAUD_TRITON_URL',
    defaultUrl: null,
    probePath: '/v2/health/ready',
    status: 'declared',
    notes:
      'Preprocessing entrypoints are bare scripts (src/preprocess_TabFormer*.py) with no argument ' +
      'parser, so the process adapter must pass configuration by environment and working directory.',
  },
  {
    id: 'distillation',
    repo: 'QGI ai-model-distillation-for-financial-data',
    kind: 'http',
    role: 'neural',
    capability: 'Teacher-to-student distillation jobs for financial models.',
    env: 'MINEAI_DISTILL_URL',
    defaultUrl: null,
    probePath: '/docs',
    status: 'declared',
    notes: 'FastAPI service (src/app.py, src/api/endpoints.py); no console entrypoint is published.',
  },
  {
    id: 'finrobot',
    repo: 'AI4Finance-Foundation/FinRobot',
    kind: 'http',
    role: 'neural',
    capability: 'Multi-agent equity research and report generation.',
    env: 'MINEAI_FINROBOT_URL',
    defaultUrl: null,
    probePath: '/',
    status: 'declared',
    notes: 'Reachable only through run_web_app.py; setup.py declares no console_scripts.',
  },
  {
    id: 'fin-agent',
    repo: 'Quantum-General-Intelligence/Fin-Agent',
    kind: 'http',
    role: 'neural',
    capability: 'Financial multi-agent workflows (FinRobot-derived package layout).',
    env: 'MINEAI_FIN_AGENT_URL',
    defaultUrl: null,
    probePath: '/',
    status: 'declared',
    notes: 'Library only; no console entrypoint.',
  },
  {
    id: 'fincept-terminal',
    repo: 'SamSammane/FinceptTerminal',
    kind: 'mcp-client',
    role: 'neural',
    capability: 'Qt desktop terminal that already embeds a full MCP client.',
    env: null,
    defaultUrl: null,
    probePath: null,
    status: 'declared',
    notes:
      'Consumer rather than provider: it discovers tools through fincept-qt/src/mcp, so pointing it ' +
      'at `mineai mcp serve` needs no change on this side.',
  },
  {
    id: 'finance-skills',
    repo: 'SamSammane/Awesome-finance-skills',
    kind: 'agent',
    role: 'neural',
    capability: 'Market, news and sentiment skills for agent runtimes.',
    env: null,
    defaultUrl: null,
    probePath: null,
    status: 'declared',
    notes: 'Skill bundles with no product CLI; integrates by consuming `mineai mcp serve`.',
  },
  {
    id: 'finance-llms',
    repo: 'SamSammane/Finance-LLMs',
    kind: 'corpus',
    role: 'reference',
    capability: 'Curated survey of deployed LLM and agent use cases in financial services.',
    env: null,
    defaultUrl: null,
    probePath: null,
    status: 'declared',
    notes: 'Documentation only — no executable surface. Useful as prior-art context, not as a call target.',
  },
];

export function listAdapters() {
  return ADAPTERS.map((a) => ({ ...a, configuredUrl: resolveUrl(a) }));
}

export function getAdapter(id) {
  return ADAPTERS.find((a) => a.id === id) || null;
}

// An adapter is only usable when we know where it lives. Environment always
// wins so an operator can repoint a service without touching the source.
export function resolveUrl(adapter) {
  if (!adapter) return null;
  const fromEnv = adapter.env ? process.env[adapter.env] : null;
  const url = fromEnv || adapter.defaultUrl || null;
  return url ? url.replace(/\/+$/, '') : null;
}

export function isConfigured(adapter) {
  return Boolean(resolveUrl(adapter));
}
