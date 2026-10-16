import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gateway", ROOT / "backend/model_gateway.py")
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)


class Provider(BaseHTTPRequestHandler):
    response = {"choices": [{"message": {"content": "指针保存地址。\n示例：vector<int>。"}, "finish_reason": "stop"}]}
    status = 200
    received = None

    def log_message(self, *_):
        pass

    def do_POST(self):
        Provider.received = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.send_response(Provider.status)
        self.end_headers()
        # Providers commonly escape non-ASCII characters. The gateway must decode these.
        self.wfile.write(json.dumps(Provider.response).encode())


class GatewayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.provider = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
        threading.Thread(target=cls.provider.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.provider.shutdown()
        cls.provider.server_close()

    def setUp(self):
        Provider.status = 200
        Provider.response = {"choices": [{"message": {"content": "指针保存地址。\n示例：vector<int>。"}, "finish_reason": "stop"}]}
        self.env = patch.dict(os.environ, {
            "LLM_API_URL": f"http://127.0.0.1:{self.provider.server_port}/chat/completions",
            "LLM_API_KEY": "test-only-not-a-real-key", "LLM_MODEL": "test-model",
            "LLM_TIMEOUT_SECONDS": "2", "LLM_THINKING": "",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.payload = {"course_id": "cpp", "question": "什么是指针？", "context": "指针保存地址。"}

    def test_success_and_context(self):
        result = gateway.generate(self.payload)
        self.assertEqual(result["mode"], "generated")
        self.assertIn("vector<int>", result["answer"])
        user_data = json.loads(Provider.received["messages"][1]["content"])
        self.assertEqual(user_data, self.payload)

    def test_unconfigured(self):
        with patch.dict(os.environ, {"LLM_API_KEY": ""}):
            self.assertEqual(gateway.generate(self.payload)["reason"], "not_configured")

    def test_thinking_configuration(self):
        with patch.dict(os.environ, {"LLM_THINKING": "disabled"}):
            self.assertEqual(gateway.generate(self.payload)["mode"], "generated")
            self.assertEqual(Provider.received["thinking"], {"type": "disabled"})
        gateway.generate(self.payload)
        self.assertNotIn("thinking", Provider.received)
        with patch.dict(os.environ, {"LLM_THINKING": "typo"}):
            self.assertEqual(gateway.generate(self.payload)["reason"], "invalid_config")

    def test_bad_provider_response(self):
        for response in ({}, {"choices": []}, {"choices": [{"message": {"content": None}}]},
                         {"choices": [{"message": {"content": "partial"}, "finish_reason": "length"}]}):
            Provider.response = response
            self.assertEqual(gateway.generate(self.payload)["mode"], "retrieval")

    def test_provider_error(self):
        Provider.status = 429
        self.assertEqual(gateway.generate(self.payload)["reason"], "provider_error")

    def test_timeout(self):
        with patch.object(urllib.request.OpenerDirector, "open", side_effect=TimeoutError):
            self.assertEqual(gateway.generate(self.payload)["mode"], "retrieval")

    def test_insecure_remote_url(self):
        for endpoint in ("http://example.com/chat/completions", "http://[invalid"):
            with patch.dict(os.environ, {"LLM_API_URL": endpoint}):
                self.assertEqual(gateway.generate(self.payload)["reason"], "invalid_config")

    def test_env_preserves_process_values(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / ".env"
            env.write_text('LLM_MODEL="from-file"\nOTHER=value\n', encoding="utf-8")
            gateway.load_env(env)
            self.assertEqual(os.environ["LLM_MODEL"], "test-model")

    def test_cpp_integration(self):
        executable = ROOT / "build/app/mashang_server.exe"
        self.assertTrue(executable.exists(), "Run scripts/build.ps1 first")
        local_gateway = ThreadingHTTPServer(("127.0.0.1", 8081), gateway.Handler)
        threading.Thread(target=local_gateway.serve_forever, daemon=True).start()
        process = None
        try:
            with tempfile.TemporaryDirectory(dir=ROOT / "build") as directory:
                directory = Path(directory)
                shutil.copytree(ROOT / "knowledge_base", directory / "knowledge_base")
                (directory / "frontend").mkdir()
                (directory / "frontend/index.html").write_text("test frontend", encoding="utf-8")
                def start():
                    child = subprocess.Popen([str(executable)], cwd=directory,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                    for _ in range(40):
                        if child.poll() is not None:
                            self.fail("Backend failed to start; ensure port 8080 is free")
                        try:
                            urllib.request.urlopen("http://127.0.0.1:8080/api/health", timeout=1).close()
                            return child
                        except OSError:
                            time.sleep(.1)
                    child.terminate()
                    child.wait()
                    self.fail("Backend did not become ready")

                def request(path, data=None, method=None):
                    req = urllib.request.Request("http://127.0.0.1:8080" + path,
                        data=json.dumps(data, ensure_ascii=False).encode() if data is not None else None,
                        headers={"Content-Type": "application/json"}, method=method)
                    with urllib.request.urlopen(req, timeout=5) as response:
                        return json.load(response)

                process = start()
                question = {"course_id": "cpp", "question": "指针和引用有什么区别？"}
                answer = request("/api/ask", question)
                self.assertEqual(answer["mode"], "generated")
                self.assertTrue(answer["sources"])
                self.assertIn("vector<int>", answer["answer"])
                self.assertIn("指针", json.loads(Provider.received["messages"][1]["content"])["context"])
                Provider.status = 500
                fallback = request("/api/ask", question)
                self.assertEqual(fallback["mode"], "retrieval")
                self.assertIn("暂不可用", fallback["notice"])
                with patch.dict(os.environ, {"LLM_API_KEY": ""}):
                    self.assertIn("尚未配置", request("/api/ask", question)["notice"])
                unknown = request("/api/ask", {"course_id": "cpp", "question": "今天天气怎么样？"})
                self.assertEqual(unknown["mode"], "no_evidence")
                self.assertEqual(unknown["sources"], [])
                with self.assertRaises(urllib.error.HTTPError) as error:
                    request("/api/ask", {"course_id": "cpp", "question": "   "})
                self.assertEqual(error.exception.code, 400)
                request("/api/wrong-questions", {**question, "answer": answer["answer"], "knowledge_point": "指针与引用"})
                item_id = request("/api/wrong-questions")["items"][0]["id"]
                request(f"/api/wrong-questions/{item_id}/status", {"status": "已掌握"}, "PUT")
                before = request("/api/wrong-questions")
                self.assertEqual(before["items"][0]["status"], "已掌握")
                recommendations = request("/api/recommendations?course_id=cpp")
                self.assertGreater(recommendations["count"], 0)
                judged = request("/api/exercises/submit", {"exercise_id": 101, "answer": "B"})
                self.assertTrue(judged["correct"])
                process.terminate()
                process.wait(timeout=5)
                process = start()
                self.assertEqual(request("/api/wrong-questions"), before)
                with urllib.request.urlopen("http://127.0.0.1:8080/", timeout=2) as response:
                    self.assertEqual(response.read(), b"test frontend")
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen("http://127.0.0.1:8080/.env", timeout=2)
                self.assertEqual(error.exception.code, 404)
                process.terminate()
                process.wait(timeout=5)
                process = None
        finally:
            if process is not None:
                process.terminate()
                process.wait(timeout=5)
            local_gateway.shutdown()
            local_gateway.server_close()


if __name__ == "__main__":
    unittest.main()
