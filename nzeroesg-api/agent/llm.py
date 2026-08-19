from langchain_openai import ChatOpenAI

from config import settings


def load_llm():
    if not settings.assistant_enabled:
        raise RuntimeError("The CarbonSage agent preview is disabled.")

    if settings.llm_provider == "openai":
        if not settings.openai_api_key or not settings.openai_model:
            raise RuntimeError("OPENAI_API_KEY and OPENAI_MODEL are required.")
        return ChatOpenAI(
            model=settings.openai_model,
            temperature=0,
            api_key=settings.openai_api_key,
            max_tokens=1_000,
        )

    if settings.llm_provider == "openrouter":
        if not settings.openrouter_api_key or not settings.openrouter_model:
            raise RuntimeError("OPENROUTER_API_KEY and OPENROUTER_MODEL are required.")
        return ChatOpenAI(
            model=settings.openrouter_model,
            temperature=0,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            max_tokens=1_000,
            timeout=30,
            max_retries=2,
            default_headers={
                "HTTP-Referer": "https://www.carbonsage.ca",
                "X-Title": "CarbonSage",
            },
            extra_body={
                "provider": {
                    "require_parameters": True,
                    "data_collection": "deny",
                }
            },
        )

    raise RuntimeError("LLM_PROVIDER must be 'openai' or 'openrouter'.")
