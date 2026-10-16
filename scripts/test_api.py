"""One small real API request; never print keys or raw provider responses."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from model_gateway import generate, load_env


def main():
    load_env(ROOT / ".env")
    result = generate({
        "course_id": "cpp",
        "question": "根据资料用一句话解释什么是指针，不需要代码示例。",
        "context": "指针是保存对象内存地址的变量。",
    })
    if result.get("mode") == "generated":
        print("PASS: model API returned a non-empty, complete answer.")
        return 0
    reason = result.get("reason")
    if reason == "not_configured":
        print("NOT CONFIGURED: fill LLM_API_KEY in the project .env, then retry. No API request was sent.")
        return 2
    status = result.get("http_status")
    messages = {
        401: "API key rejected. Check the local key.",
        402: "Insufficient provider account balance.",
        429: "Provider rate limit reached. Retry later.",
        500: "Provider server error. Retry later.",
        503: "Provider unavailable. Retry later.",
    }
    if status:
        print(f"FAILED: HTTP {status}. " + messages.get(status, "Check the provider endpoint and model."))
    elif reason == "invalid_config":
        print("FAILED: invalid endpoint or model configuration in .env.")
    else:
        print("FAILED: network timeout, connection failure or incomplete model response.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
