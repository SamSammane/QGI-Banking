# Integration Plan

How the sibling reference implementations connect to this CLI, why the seams sit where they do, and what remains to build.

Every file reference below was read from the repository it names. Where a claim is about something *absent* — no console entrypoint, no argument parser — that absence was checked, not assumed.

---

## 1. The problem this plan solves

Ten repositories cover overlapping ground in payment security, fraud detection, and AML/CFT compliance. Exactly one of them ships an installable command-line entrypoint:

| | Repository | Installable CLI? | Evidence |
| --- | --- | --- | --- |
| 1 | **mine-ai** (this repo) | **Yes** | `package.json` → `"bin": {"mineai": "bin/mineai.js"}`; command tree in `src/cli.js` |
| 2 | watchman | No — long-running servers | `cmd/server/main.go`, `cmd/postal-server/main.go` parse no flags; configuration arrives through `internal/config` |
| 3 | kyc-analyst | No — agent plugin | `plugin.json` declares six `capabilities.commands`, implemented as prompts in `commands/*.md` |
| 4 | Awesome-finance-skills | No | Ten skill bundles under `skills/*/SKILL.md`; only `skills/skill-creator/scripts/*.py` parse arguments, and those are authoring tools |
| 5 | Finance-LLMs | No — no code at all | `README.md` plus `assets/` |
| 6 | FinceptTerminal | No — desktop GUI | Qt/CMake application; no `QCommandLineParser` in `fincept-qt/src` |
| 7 | financial-fraud-detection | No | `src/preprocess_TabFormer*.py` take no arguments; work is driven from notebooks |
| 8 | ai-model-distillation | No | `pyproject.toml` declares no `[project.scripts]`; entry is the FastAPI app |
| 9 | FinRobot | No installed entrypoint | `setup.py` declares no `console_scripts`. **Note:** `run_web_app.py` *does* parse `--host`/`--port`/`--reload` via `argparse` (lines 60–95) — it is a launchable service, just not an installed command |
| 10 | Fin-Agent | No installed entrypoint | `setup.py` declares no `console_scripts`; package layout mirrors FinRobot |

The consequence: there is no single place to drive this work from, and no shared way to check what any of the generative components assert.

## 2. Principles

**One hub, no vendoring.** mine-ai is the host because it is the only repo with an installable command surface to extend. Every other system is reached across a network or process boundary. Nothing is copied in — five of these repositories are downstream of upstreams (`moov-io/watchman`, an NVIDIA blueprint, `AI4Finance-Foundation/FinRobot`, `vyayasan/kyc-analyst`), and vendoring their code would convert every upstream release into a merge conflict.

**Symbolic and neural are different kinds of thing.** A *symbolic* system is deterministic: the same input yields the same output, so it can serve as an oracle that contradicts a model. A *neural* system emits claims that need checking. `src/adapters/registry.js` tags every entry with this distinction because it decides which direction verification flows.

**Declared is not implemented.** The registry records integration points that do not yet exist as adapters, with `status: 'declared'`. An honest map of unbuilt work beats a map that implies more than is there.

**An unrun check is not a passed check.** When a backend is unreachable, `src/verify/engine.js` reports `skipped`, never `pass`.

---

## 3. Architecture

```
                    ┌──────────────────────────────┐
   agent runtimes   │   mineai mcp serve (stdio)   │   MCP clients call in
   ───────────────► │   src/mcp/server.js          │ ◄─────────────────────
   kyc-analyst      └──────────────┬───────────────┘   FinceptTerminal
   finance-skills                  │                   Claude Code / Cowork
                                   ▼
                    ┌──────────────────────────────┐
                    │   mineai verify              │  neural claim
                    │   src/verify/engine.js       │  ──► symbolic check
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
     │  SYMBOLIC      │   │  NEURAL        │   │  REFERENCE     │
     │  oracles       │   │  claim sources │   │  corpora       │
     ├────────────────┤   ├────────────────┤   ├────────────────┤
     │ watchman       │   │ fraud-detection│   │ Finance-LLMs   │
     │ kyc-analyst    │   │ distillation   │   │                │
     │ citations.js   │   │ FinRobot       │   │                │
     │ patterns/      │   │ Fin-Agent      │   │                │
     └────────────────┘   └────────────────┘   └────────────────┘
```

Three transport classes carry all of it, implemented in `src/adapters/`:

- **HTTP** (`http.js`) — services with JSON APIs: watchman, distillation, FinRobot, Fin-Agent.
- **Process** (`process.js`) — repos whose entry is a script: fraud-detection preprocessing, distillation shell scripts.
- **MCP** (`../mcp/server.js`) — agent runtimes that consume tools rather than expose them: kyc-analyst, Awesome-finance-skills, FinceptTerminal.

---

## 4. Per-repository plan

### 4.1 watchman — sanctions screening · symbolic · **implemented**

The one adapter that is live. Watchman resolves a name against sanctions and PEP lists by deterministic matching, which is precisely what makes it usable as an oracle.

| | |
| --- | --- |
| Reached by | `GET /v2/search?name=&limit=&minMatch=` — route registered in `internal/search/api_search.go:44-55` |
| Response | `SearchResponse{entities: []SearchedEntity}`; the score field is `match` (`pkg/search/model_searched_entity.go:6`) |
| Default port | `:8084` (`configs/config.default.yml`, asserted in `internal/config/config_test.go:23`) |
| Config | `MINEAI_WATCHMAN_URL` |
| Adapter | `src/adapters/watchman.js` |
| Surfaced as | `mineai screen`, the `sanctions-screening` check, MCP tool `screen_entity` |

The response shape is pinned by a contract test in `test/adapters.test.js` that serves the documented payload from a local stub, so an upstream change surfaces as a test failure rather than as a wrong answer in production.

**Also available, not yet used:** watchman serves MCP itself at `/mcp` (`internal/mcp/server.go:35`, tool `search_entities`, streamable HTTP with `JSONResponse: true`). We call the REST route because it is narrower and needs no session handling. If watchman's MCP surface grows tools that REST does not expose, revisit.

**Remaining:** address matching via `pkg/address`; `us_ofac`-only vs. multi-list threshold policy — the default `minMatch` of 0.85 is a starting point, not a calibrated one.

### 4.2 kyc-analyst — customer risk scoring · symbolic · **deliberately not re-implemented**

Its four-factor model is deterministic and would make an excellent oracle. It is still not being ported, for a reason stated in the repo itself: the weights derive from FATF/EBA/FinCEN guidance and the README (line 403) says the model "has not been independently validated" and that firms "should calibrate the weights and thresholds to match your risk appetite."

Freezing a copy of those weights inside a general-purpose CLI would produce a second, silently diverging scorer. So the integration runs the other way: kyc-analyst is a Claude Code / Cowork plugin (`plugin.json`) whose skills live in `skills/*/SKILL.md`, and it already documents MCP consumption in `MCP_INTEGRATION_GUIDE.md`. It calls **us**.

**Steps:** register `mineai mcp serve` in the plugin's MCP configuration; have its `screening` skill (`skills/screening/SKILL.md`) call `screen_entity` instead of describing manual searching; have its report step call `verify_reasoning` before output. No code lands in this repo.

### 4.3 financial-fraud-detection — fraud inference · neural · **declared**

An NVIDIA blueprint: TabFormer preprocessing in `src/preprocess_TabFormer.py` (plus `_lp`/`_np` variants), notebooks in `notebooks/`, and a Triton image (`triton/Dockerfile`, `FROM nvcr.io/nvidia/tritonserver:25.04-py3`).

Two distinct seams, and they should not be conflated:

1. **Inference** — Triton speaks HTTP/gRPC. `MINEAI_FRAUD_TRITON_URL`, probe `/v2/health/ready`, use `http.js`. This is the one worth building: it turns `mineai detect` from a feature snapshot into a real prediction.
2. **Preprocessing** — the scripts parse no arguments, so `process.js` must pass configuration by environment and working directory, and any argument-passing convention we invent is ours alone and will break if upstream adds a parser.

**Gating:** requires GPU hardware and NGC credentials. Cannot be exercised in CI; needs a recorded-fixture test instead.

### 4.4 ai-model-distillation — teacher→student distillation · neural · **declared**

FastAPI service: `src/app.py:24` creates the app and `src/app.py:27` mounts the router under `/api`. Job endpoints in `src/api/endpoints.py` — `POST /jobs` (line 40), `GET /jobs` (79), `GET /jobs/{job_id}` (105), `DELETE /jobs/{job_id}` (113), `POST /jobs/{job_id}/cancel` (125). Celery workers under `src/tasks`, orchestrated by `scripts/run.sh`.

Job submission is asynchronous, which shapes the CLI surface: `mineai distill submit` returns a job id, `mineai distill status <id>` polls. Config `MINEAI_DISTILL_URL`. Note the package is named `fbp` in `pyproject.toml`, not by its repository name.

### 4.5 FinRobot / Fin-Agent — multi-agent research · neural · **declared**

Fin-Agent is a FinRobot derivative: identical package layout (`agents/`, `data_source/`, `functional/`, `toolkits.py`, `utils.py`), different metadata (`setup.py` — Apache-2.0, Quantum General Intelligence; FinRobot is MIT, AI4Finance). One adapter shape serves both; `MINEAI_FINROBOT_URL` and `MINEAI_FIN_AGENT_URL` keep them separately addressable.

FinRobot's web app binds `127.0.0.1:8001` by default and accepts `--host`/`--port` (`run_web_app.py:60-95`), so the process adapter can launch it directly rather than requiring a separately managed service.

Their generated equity research is exactly the kind of output `verify_reasoning` exists for — but note the citation set in `src/policy/citations.js` is AML/CFT regulatory material, so `citation-keys` would not be meaningful against equity research without a corpus extension. Do that first, or the check produces confident noise.

### 4.6 FinceptTerminal — desktop terminal · MCP client · **declared, near-zero work**

The cheapest integration in this plan, because nothing needs writing on either side.

`fincept-qt/src/mcp/McpClient.h:2` describes itself as "JSON-RPC 2.0 over stdio for external MCP servers." `McpServerConfig` (`McpClient.h:22-35`) carries `command`, `args`, and `env` — the exact registration shape `mineai mcp serve` expects. The subsystem already includes `McpManager`, `ToolRetriever`, `SchemaValidator`, and `TerminalMcpBridge`.

**Step:** add a server entry with `command: "mineai"`, `args: ["mcp", "serve"]`. All eight tools become available in the terminal with no code change here.

### 4.7 Awesome-finance-skills — agent skills · neural · **declared**

Ten skills as `SKILL.md` files with YAML frontmatter (`name`, `description`) plus Python helpers. Consumers of tools, not providers.

The `alphaear-*` skills generate market and sentiment claims with no verification step. Routing their output through `verify_reasoning` is the natural pairing — with the same corpus caveat as §4.5.

### 4.8 Finance-LLMs — reference corpus · **no executable surface**

`README.md` (196 lines) and `assets/`. There is nothing to call and no adapter to write; the registry lists it as `role: 'reference'` so the map stays complete. Its value is prior art — deployed LLM use cases in financial services, useful when deciding what to build, not something to build against.

---

## 5. Sequencing

Ordered by ratio of value to effort, not by repository.

**Phase 1 — done.** Verification engine, adapter registry, watchman adapter, MCP server, 55 tests. Merged in PR #1.

**Phase 2 — consumption, no new code here.** Register `mineai mcp serve` in FinceptTerminal (§4.6) and kyc-analyst (§4.2). Both are configuration-only, and together they put verification in front of two real workflows. Do these first precisely because they are cheap.

**Phase 3 — corpus.** Extend `src/policy/citations.js` beyond AML/CFT before pointing `verify_reasoning` at equity research. Without this, §4.5 and §4.7 produce checks that look authoritative and mean nothing. This is a prerequisite, not a nice-to-have.

**Phase 4 — Triton inference** (§4.3). Highest engineering value: `mineai detect` stops being descriptive. Blocked on GPU access and NGC credentials.

**Phase 5 — distillation and multi-agent HTTP adapters** (§4.4, §4.5). Mechanical once Phase 3 lands.

---

## 6. Decisions taken, and what would reverse them

| Decision | Reasoning | What would change it |
| --- | --- | --- |
| mine-ai hosts the CLI | Only repo with an installable entrypoint; MIT; one dependency; already contains the symbolic/neural seam | If ownership matters more than head start, Fin-Agent is the alternative — but it has no CLI, no citation layer, and would be a from-scratch build |
| Adapters, never vendoring | Five repos are downstream of upstreams; copying code makes every upstream release a conflict | A repo going unmaintained might justify a fork |
| kyc-analyst scoring stays where it is | Weights are documented as requiring per-firm calibration | An upstream-published, validated reference implementation |
| Hand-written MCP server | Protocol surface for a tool provider is three methods; the install stays at one dependency | Needing resources, prompts, or sampling — at which point use the SDK |
| watchman via REST, not its MCP endpoint | Narrower, no session handling | MCP-only tools appearing upstream |

## 7. Known gaps

- **No CI.** This repository has no workflows; the 55 tests run only when someone runs `npm test`. Phase 2 should not start before that is fixed, or regressions land silently.
- **The citation corpus is AML/CFT-only** — the constraint behind Phase 3.
- **`minMatch` 0.85 is uncalibrated.** A default, not a validated threshold.
- **Entity extraction is not NER.** `extractEntityCandidates` matches capitalised runs; it over-collects, which is why screening warns rather than fails.
- **Phases 4–5 are unverifiable here.** GPU hardware and credentials are unavailable in this environment; those adapters need recorded fixtures.
