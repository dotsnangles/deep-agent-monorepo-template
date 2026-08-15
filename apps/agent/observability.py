import logging
import os

logger = logging.getLogger("agent.observability")


def get_langfuse_callback():
    """Returns a Langfuse CallbackHandler if configured in the environment."""
    public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = os.getenv("LANGFUSE_SECRET_KEY")

    if not public_key or not secret_key:
        return None

    try:
        from langfuse.langchain import CallbackHandler

        handler = CallbackHandler()
        print("[LANGFUSE] CallbackHandler initialized and active.")
        return handler
    except Exception as exc:
        print(f"[LANGFUSE] Failed to initialize callback handler: {exc}")
        return None
