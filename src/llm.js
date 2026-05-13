export function readLlmEnv(overrides = {}) {
  const apiKey = overrides.apiKey || process.env.OPENAI_API_KEY;
  const baseUrl = (overrides.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = overrides.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return { apiKey, baseUrl, model };
}

export async function chatComplete({ apiKey, baseUrl, model, system, user, temperature = 0.2 }) {
  if (!apiKey) {
    const err = new Error(
      'No API key found. Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL, OPENAI_MODEL) before running `mineai reason`.'
    );
    err.code = 'NO_API_KEY';
    throw err;
  }

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`LLM call failed: HTTP ${res.status} ${res.statusText}\n${text}`);
    err.code = 'LLM_HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`LLM response was not valid JSON:\n${text}`);
  }

  const content = data?.choices?.[0]?.message?.content ?? '';
  return { content, raw: data };
}
