import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from src.core.gateway import AgentExecutionGateway, _normalize_messages
from src.core.testing import FakeChatModel


def test_normalize_messages_with_plain_text():
    raw_messages = [
        {"role": "user", "content": "Hello agent"},
    ]
    normalized = _normalize_messages(raw_messages)
    assert len(normalized) == 2
    assert isinstance(normalized[0], SystemMessage)
    assert isinstance(normalized[1], HumanMessage)
    assert normalized[1].content == "Hello agent"


def test_normalize_messages_with_image_attachments():
    raw_messages = [
        {
            "role": "user",
            "content": "Describe this photo",
            "attachments": [
                {
                    "id": "att_1",
                    "name": "photo.png",
                    "url": "https://storage.local/photo.png",
                    "mime_type": "image/png",
                    "size": 10240,
                    "s3_key": "attachments/photo.png",
                }
            ],
        }
    ]
    normalized = _normalize_messages(raw_messages)
    assert len(normalized) == 2
    user_msg = normalized[1]
    assert isinstance(user_msg, HumanMessage)
    assert isinstance(user_msg.content, list)
    assert len(user_msg.content) == 2
    assert user_msg.content[0] == {"type": "text", "text": "Describe this photo"}
    assert user_msg.content[1] == {
        "type": "image_url",
        "image_url": {"url": "https://storage.local/photo.png"},
    }


def test_normalize_messages_with_document_attachments():
    raw_messages = [
        {
            "role": "user",
            "content": "Summarize this report",
            "attachments": [
                {
                    "id": "doc_1",
                    "name": "financial_report.pdf",
                    "url": "https://storage.local/financial_report.pdf",
                    "mime_type": "application/pdf",
                    "size": 524288,
                    "s3_key": "attachments/financial_report.pdf",
                },
                {
                    "id": "doc_2",
                    "name": "data.csv",
                    "url": "https://storage.local/data.csv",
                    "mime_type": "text/csv",
                    "size": 2048,
                    "s3_key": "attachments/data.csv",
                },
            ],
        }
    ]
    normalized = _normalize_messages(raw_messages)
    assert len(normalized) == 2
    user_msg = normalized[1]
    assert isinstance(user_msg, HumanMessage)
    assert isinstance(user_msg.content, str)
    assert "Summarize this report" in user_msg.content
    assert "[Attached Documents]" in user_msg.content
    assert "financial_report.pdf" in user_msg.content
    assert "application/pdf" in user_msg.content
    assert "data.csv" in user_msg.content


def test_normalize_messages_with_mixed_multimodal_and_documents():
    raw_messages = [
        {
            "role": "user",
            "content": "Analyze both",
            "attachments": [
                {
                    "id": "att_img",
                    "name": "chart.webp",
                    "url": "https://storage.local/chart.webp",
                    "mime_type": "image/webp",
                    "size": 5000,
                    "s3_key": "attachments/chart.webp",
                },
                {
                    "id": "att_doc",
                    "name": "notes.md",
                    "url": "https://storage.local/notes.md",
                    "mime_type": "text/markdown",
                    "size": 1200,
                    "s3_key": "attachments/notes.md",
                },
            ],
        }
    ]
    normalized = _normalize_messages(raw_messages)
    user_msg = normalized[1]
    assert isinstance(user_msg.content, list)
    # First block is text containing prompt + formatted doc section
    assert user_msg.content[0]["type"] == "text"
    assert "Analyze both" in user_msg.content[0]["text"]
    assert "notes.md" in user_msg.content[0]["text"]
    # Second block is image_url
    assert user_msg.content[1]["type"] == "image_url"
    assert user_msg.content[1]["image_url"]["url"] == "https://storage.local/chart.webp"


@pytest.mark.asyncio
async def test_gateway_stream_execution_with_multimodal_payload():
    fake_model = FakeChatModel(tokens=["Image", " ", "analyzed", "."])
    gateway = AgentExecutionGateway(model=fake_model)

    messages = [
        {
            "role": "user",
            "content": "What is in this diagram?",
            "attachments": [
                {
                    "id": "att_diag",
                    "name": "diagram.png",
                    "url": "https://storage.local/diagram.png",
                    "mimeType": "image/png",
                    "size": 8192,
                    "s3Key": "attachments/diagram.png",
                }
            ],
        }
    ]

    events = [
        event async for event in gateway.stream_execution(messages=messages, agent_type="direct")
    ]
    assert len(events) >= 2
    token_events = [e for e in events if e.event == "token"]
    assert len(token_events) > 0
    done_event = next(e for e in events if e.event == "done")
    assert done_event.data.finish_reason == "stop"

    # Verify FakeChatModel received the multimodal HumanMessage
    assert len(fake_model.received_messages) > 0
    received_user_msg = fake_model.received_messages[0][1]
    assert isinstance(received_user_msg.content, list)
    assert received_user_msg.content[1]["image_url"]["url"] == "https://storage.local/diagram.png"
