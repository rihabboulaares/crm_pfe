"""
agentEngagement/message_builder.py
Convertit EngagementResultSchema en objet compatible avec task_manager.
"""


class MessageData:
    def __init__(self, result):
        self.channel = result.best_channel
        self.subject = result.subject or ""
        self.message = result.message or ""
        self.call_script = result.call_script or ""
        self.task_title = result.task_title or ""
        self.task_description = result.task_description or ""


def build_message_data(result):
    return MessageData(result)