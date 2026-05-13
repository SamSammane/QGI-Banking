import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { citationsBlock, citationKeys } from '../policy/citations.js';
import { readLlmEnv, chatComplete } from '../llm.js';

const TRACE_PATH = join(homedir(), '.mineai-last-trace.json');

const SYSTEM_PROMPT = `You are Mine AI's Module 3 reasoning assistant.

Your role: produce interpretable, citation-grounded research notes on U.S. payment-security, fraud-detection, and AML/CFT compliance questions. You are a research aid, not a legal, financial, tax, or compliance advisor.

You may cite ONLY from the citation set below. If a question cannot be answered from the citation set, say so explicitly and recommend a primary source the user should consult. Do not invent statutory text, agency guidance, dollar figures, or case law that is not in the citation set.

Output format (always, even for short answers):

1. Short Answer — 1-3 sentences.
2. Reasoning — a numbered chain of reasoning steps. Each step cites the citation key in brackets, e.g. [BSA], [OFAC], [MRM-2026]. Do not cite a key that does not appear in the citation set below.
3. Sources Used — bullet list of the citation keys actually used.
4. Caveats — a short note identifying what the user should verify with primary sources or qualified counsel before acting.

Available citation keys: ${citationKeys().join(', ')}

Citation set (you may reference these by key in your Reasoning section):

${citationsBlock()}

Style: precise, hedge claims that are uncertain, never produce a SAR narrative or rendered legal opinion. If the user asks for either, redirect them to a qualified compliance or legal professional.`;

function formatTraceForPrint(trace) {
  const lines = [];
  lines.push(`--- Last reasoning trace ---`);
  lines.push(`When:     ${trace.when}`);
  lines.push(`Endpoint: ${trace.endpoint}`);
  lines.push(`Model:    ${trace.model}`);
  lines.push('');
  lines.push('Question:');
  lines.push(trace.question);
  lines.push('');
  lines.push('Answer:');
  lines.push(trace.answer);
  return lines.join('\n');
}

export async function reason(question, opts = {}) {
  const env = readLlmEnv({ model: opts.model });
  try {
    const { content, raw } = await chatComplete({
      ...env,
      system: SYSTEM_PROMPT,
      user: question,
    });

    process.stdout.write(content);
    if (!content.endsWith('\n')) process.stdout.write('\n');

    const trace = {
      when: new Date().toISOString(),
      endpoint: `${env.baseUrl}/chat/completions`,
      model: env.model,
      question,
      answer: content,
      raw_id: raw?.id || null,
    };
    try {
      writeFileSync(TRACE_PATH, JSON.stringify(trace, null, 2));
    } catch {
      // best effort; do not fail the command on trace-write errors
    }
  } catch (err) {
    if (err?.code === 'NO_API_KEY') {
      console.error(err.message);
      console.error('\nExample:');
      console.error('  export OPENAI_API_KEY=...');
      console.error('  export OPENAI_BASE_URL=https://api.openai.com/v1   # optional');
      console.error('  export OPENAI_MODEL=gpt-4o-mini                     # optional');
      process.exit(3);
    }
    throw err;
  }
}

export async function reasonTrace(which) {
  if (which !== 'last') {
    console.error('Only `--trace last` is supported in v0.1.');
    process.exit(2);
  }
  if (!existsSync(TRACE_PATH)) {
    console.error('No prior reasoning trace found. Run `mineai reason "..."` first.');
    process.exit(2);
  }
  const trace = JSON.parse(readFileSync(TRACE_PATH, 'utf8'));
  console.log(formatTraceForPrint(trace));
}
