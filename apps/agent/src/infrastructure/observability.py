import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def get_langfuse_callback() -> Any:
    langfuse_public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    langfuse_host = os.getenv("LANGFUSE_HOST", "http://localhost:3000")

    if not langfuse_public_key or not langfuse_secret_key:
        return None

    try:
        from langfuse.callback import CallbackHandler

        return CallbackHandler(
            public_key=langfuse_public_key,
            secret_key=langfuse_secret_key,
            host=langfuse_host,
        )
    except Exception as e:
        logger.warning("Failed to initialize Langfuse callback: %s", e)
        return None


get_langfuse_handler = get_langfuse_callback
