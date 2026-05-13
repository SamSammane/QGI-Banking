"""
Semantic-encoder backends for CSSA.

The paper's semantic branch is ChatGLM3-6B fine-tuned with LoRA (r=16, α=32).
For a reference implementation that does not require a 6B-parameter fine-tune
to demonstrate the architecture, we offer two backends:

  - `OpenAIEmbeddingEncoder`: calls an OpenAI-compatible /embeddings endpoint
    (OpenAI, Together, Voyage-compat, local vLLM/Ollama, etc.). This is the
    intended "real" backend.
  - `DeterministicHashEncoder`: produces stable, deterministic pseudo-embeddings
    from input strings without any network call. Used by the demo so the
    forward-pass and contrastive-alignment plumbing can be verified on CPU
    without an API key.

Neither backend reproduces ChatGLM3-6B reasoning ability. They are interfaces
that allow the rest of the CSSA pipeline to be exercised end-to-end.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from dataclasses import dataclass
from typing import Iterable, Sequence
from urllib import request, error


@dataclass
class OpenAIEmbeddingEncoder:
    """OpenAI-compatible embeddings backend. Reads OPENAI_API_KEY / OPENAI_BASE_URL."""

    model: str = "text-embedding-3-small"
    base_url: str | None = None
    api_key: str | None = None
    timeout: float = 30.0

    def __post_init__(self) -> None:
        self.base_url = (self.base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        self.api_key = self.api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise RuntimeError(
                "OpenAIEmbeddingEncoder requires OPENAI_API_KEY in the environment."
            )

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        payload = json.dumps({"model": self.model, "input": list(texts)}).encode("utf-8")
        req = request.Request(
            f"{self.base_url}/embeddings",
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
            raise RuntimeError(f"Embeddings call failed: {e.code} {e.reason} — {e.read()!r}") from e
        return [item["embedding"] for item in body["data"]]


class DeterministicHashEncoder:
    """Offline pseudo-embedding for plumbing tests. Not semantically meaningful.

    Maps each input string to a fixed-dim vector by hashing repeatedly with
    different salts. Produces stable embeddings for the same input on any
    machine, which is what the demo needs.
    """

    def __init__(self, dim: int = 64, salts: int | None = None) -> None:
        self.dim = dim
        # default: enough salts to fill dim with 4-byte chunks
        self.salts = salts if salts is not None else max(1, math.ceil(dim / 8))

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        out = []
        for text in texts:
            vec: list[float] = []
            for i in range(self.salts):
                h = hashlib.blake2b(f"{i}:{text}".encode("utf-8"), digest_size=32).digest()
                # 8 floats per salt: take 4-byte chunks, scale to [-1, 1].
                for j in range(0, 32, 4):
                    val = int.from_bytes(h[j:j + 4], "big", signed=False)
                    vec.append(((val / 0xFFFFFFFF) * 2.0) - 1.0)
                    if len(vec) >= self.dim:
                        break
                if len(vec) >= self.dim:
                    break
            out.append(vec[: self.dim])
        return out

    @property
    def embedding_dim(self) -> int:
        return self.dim


def encode_in_batches(encoder, texts: Sequence[str], batch_size: int = 64) -> list[list[float]]:
    out: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        chunk = list(texts[start:start + batch_size])
        out.extend(encoder.encode(chunk))
    return out
