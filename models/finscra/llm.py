"""OpenAI-compatible chat-completions client used by FinSCRA.

The paper's base reasoner is a LoRA-tuned ChatGLM3-6B (r=16, α=32). For a
reference implementation that can run anywhere, we abstract the call behind
an OpenAI-compatible /chat/completions endpoint: OpenAI, Together, OpenRouter,
or any local server that speaks the OpenAI protocol (vLLM, Ollama, LM Studio).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from urllib import request, error


@dataclass
class LLMClient:
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    timeout: float = 60.0
    temperature: float = 0.2

    def __post_init__(self) -> None:
        self.base_url = (self.base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        self.api_key = self.api_key or os.environ.get("OPENAI_API_KEY")
        self.model = self.model or os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"

    def chat(self, system: str, user: str) -> str:
        if not self.api_key:
            raise RuntimeError(
                "No API key found. Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL, "
                "OPENAI_MODEL) before running FinSCRA."
            )
        payload = json.dumps({
            "model": self.model,
            "temperature": self.temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }).encode("utf-8")
        req = request.Request(
            f"{self.base_url}/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except error.HTTPError as e:
            raise RuntimeError(f"LLM call failed: {e.code} {e.reason} — {e.read()!r}") from e
        return body["choices"][0]["message"]["content"]
