import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { serve } from '../mcp/server.js';
import { toolDefinitions } from '../mcp/tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function version() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

export async function mcpServe() {
  // Anything written to stdout here would land inside the JSON-RPC stream, so
  // the startup notice goes to stderr.
  process.stderr.write('mineai MCP server listening on stdio.\n');
  await serve({ serverInfo: { name: 'mineai', version: version() } });
}

export async function mcpTools(opts = {}) {
  const tools = toolDefinitions();

  if (opts.json) {
    console.log(JSON.stringify({ tools }, null, 2));
    return;
  }

  console.log('\nTools exposed by `mineai mcp serve`:\n');
  for (const t of tools) {
    const required = t.inputSchema?.required || [];
    const props = Object.keys(t.inputSchema?.properties || {});
    console.log(`  ${t.name}`);
    console.log(`    ${t.description}`);
    if (props.length) {
      console.log(`    arguments: ${props.map((p) => (required.includes(p) ? `${p}*` : p)).join(', ')}`);
    }
    console.log('');
  }
  console.log('* required.\n');
  console.log('Register with an MCP client by running `mineai mcp serve` over stdio, e.g.:\n');
  console.log('  {"command": "mineai", "args": ["mcp", "serve"]}\n');
}
