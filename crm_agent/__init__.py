# crm_agent/__init__.py

def chat_with_memory(*args, **kwargs):
    from .agent import chat_with_memory as _chat_with_memory

    return _chat_with_memory(*args, **kwargs)


def reset_memory(*args, **kwargs):
    from .agent import reset_memory as _reset_memory

    return _reset_memory(*args, **kwargs)


__all__ = ["chat_with_memory", "reset_memory"]
