"""Checked-in versioned agent policy resources."""

from functools import lru_cache
from pathlib import Path

POLICY_PATH = Path(__file__).parent / "v1.md"


@lru_cache(maxsize=1)
def load_agent_policy() -> str:
    policy = POLICY_PATH.read_text(encoding="utf-8").strip()
    if not policy:
        raise RuntimeError("The checked-in CarbonSage agent policy is empty.")
    return policy
