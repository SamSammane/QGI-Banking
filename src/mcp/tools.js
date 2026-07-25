// Tool surface exposed over MCP.
//
// Handlers return plain data and must never write to stdout — on a stdio
// transport stdout carries the JSON-RPC frames, so a stray console.log would
// corrupt the stream. That is why the command modules keep formatting separate
// from the functions called here.

import { CITATIONS } from '../policy/citations.js';
import { listPatterns, readPattern } from '../commands/pattern.js';
import { getCard, listCards } from '../models/cards.js';
import { listAdapters } from '../adapters/registry.js';
import { runVerification } from '../verify/engine.js';
import { screenEntity } from '../adapters/watchman.js';

export const TOOLS = [
  {
    name: 'verify_reasoning',
    description:
      'Run deterministic symbolic checks over model-generated compliance text: citation keys must ' +
      'resolve to the local citation set, quantitative claims must trace to it, and prohibited ' +
      'advisory output is flagged. Returns a per-check report and an overall PASS/WARN/FAIL verdict.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The generated text to verify.' },
        expectFormat: {
          type: 'boolean',
          description: 'Enforce the mandated Short Answer / Reasoning / Sources Used / Caveats structure.',
          default: false,
        },
        screen: {
          type: 'boolean',
          description: 'Also screen extracted entity names against sanctions lists (requires a configured Watchman).',
          default: false,
        },
      },
      required: ['text'],
    },
    handler: async (args) =>
      runVerification(String(args?.text ?? ''), {
        expectFormat: Boolean(args?.expectFormat),
        screen: Boolean(args?.screen),
        source: 'mcp',
      }),
  },
  {
    name: 'screen_entity',
    description:
      'Screen a name against sanctions and PEP source lists using deterministic matching. Scores are ' +
      'name similarity, not confirmed identifications. Requires MINEAI_WATCHMAN_URL.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Entity name to screen.' },
        type: {
          type: 'string',
          description: 'Optional entity type: person, business, organization, aircraft, vessel.',
        },
        limit: { type: 'number', description: 'Maximum matches to return.', default: 5 },
        minMatch: { type: 'number', description: 'Minimum similarity score, 0 to 1.', default: 0.85 },
      },
      required: ['name'],
    },
    handler: async (args) =>
      screenEntity(String(args?.name ?? ''), {
        type: args?.type ?? null,
        limit: Number(args?.limit) || 5,
        minMatch: args?.minMatch === undefined ? 0.85 : Number(args.minMatch),
      }),
  },
  {
    name: 'list_citations',
    description:
      'The closed regulatory citation set this CLI grounds reasoning in. Any citation key outside ' +
      'this set is fabricated by definition.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ count: CITATIONS.length, citations: CITATIONS }),
  },
  {
    name: 'list_patterns',
    description: 'Index of production risk-control and reconciliation patterns.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ patterns: listPatterns() }),
  },
  {
    name: 'get_pattern',
    description: 'Full text of one risk-control pattern document.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Pattern name from list_patterns.' } },
      required: ['name'],
    },
    handler: async (args) => {
      const doc = readPattern(String(args?.name ?? ''));
      if (!doc) throw new Error(`Pattern "${args?.name}" not found.`);
      return doc;
    },
  },
  {
    name: 'list_models',
    description: 'Reference fraud-detection model cards available in this repository.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ models: listCards() }),
  },
  {
    name: 'get_model_card',
    description: 'Model card for one reference detector, including its reference publication and build status.',
    inputSchema: {
      type: 'object',
      properties: { model: { type: 'string', description: 'cnn-lstm | cssa | finscra' } },
      required: ['model'],
    },
    handler: async (args) => {
      const card = getCard(String(args?.model ?? ''));
      if (!card) throw new Error(`Unknown model "${args?.model}". Available: ${listCards().join(', ')}`);
      return card;
    },
  },
  {
    name: 'list_adapters',
    description:
      'Integration registry of sibling reference implementations, each tagged symbolic (deterministic, ' +
      'usable as a verification oracle) or neural (produces claims that need checking).',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ adapters: listAdapters() }),
  },
];

export function toolDefinitions() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

export function findTool(name) {
  return TOOLS.find((t) => t.name === name) || null;
}
