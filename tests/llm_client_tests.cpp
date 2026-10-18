#include <httplib.h>
#include "llm_client.h"
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Data.Json.h>
#include <atomic>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <thread>

using namespace mashangzhixin;
using namespace winrt::Windows::Data::Json;
void check(bool value, const char *name) {
    if (!value) throw std::runtime_error(name);
    std::cout << "PASS: " << name << '\n';
}
int main(int argc, char** argv) {
    // A separate process avoids masking the server's COM lifetime with this test's apartment.
    if (argc == 2 && std::string(argv[1]) == "--mock-provider") {
        httplib::Server provider;
        provider.Post("/chat/completions", [](const httplib::Request&, httplib::Response& response) {
            response.set_content(R"({"choices":[{"message":{"content":"Mock course explanation"},"finish_reason":"stop"}]})", "application/json");
        });
        const int port = provider.bind_to_any_port("127.0.0.1");
        if (port < 0) return 2;
        std::cout << port << std::endl;
        return provider.listen_after_bind() ? 0 : 3;
    }
    winrt::init_apartment();
    httplib::Server server;
    std::atomic<int> scenario{0};
    std::atomic<bool> payload_valid{false};
    server.Post("/chat/completions", [&](const httplib::Request &request, httplib::Response &response) {
        winrt::init_apartment();
        try {
            const auto body = JsonObject::Parse(winrt::to_hstring(request.body));
            payload_valid = body.GetNamedString(L"model") == L"mock" &&
                body.GetNamedArray(L"messages").Size() == 2 &&
                body.GetNamedObject(L"thinking").GetNamedString(L"type") == L"disabled" &&
                request.get_header_value("Authorization") == "Bearer test-only";
        } catch (...) { payload_valid = false; }
        winrt::uninit_apartment();
        switch (scenario.load()) {
        case 1: response.status = 402; return;
        case 2: response.set_content("{invalid", "application/json"); return;
        case 3: response.set_content(R"({"choices":[{"message":{"content":"partial"},"finish_reason":"length"}]})", "application/json"); return;
        case 4: response.set_content(R"({"choices":[{"message":{"content":"   "},"finish_reason":"stop"}]})", "application/json"); return;
        case 5: response.set_redirect("http://127.0.0.1:1/credential-leak", 302); return;
        case 6: std::this_thread::sleep_for(std::chrono::milliseconds(1600)); break;
        case 7: response.set_content(R"({"choices":[]})", "application/json"); return;
        case 8: response.set_content(std::string(1024 * 1024 + 1, 'x'), "application/json"); return;
        }
        response.set_content(R"({"choices":[{"message":{"content":"\u6307\u9488\nvector<int> \ud83d\ude00"},"finish_reason":"stop"}]})", "application/json");
    });
    const int port = server.bind_to_any_port("127.0.0.1");
    if (port < 0) return 2;
    std::thread worker([&] { server.listen_after_bind(); });
    int exit_code = 0;
    try {
        LlmConfig config;
        config.api_url = "http://127.0.0.1:" + std::to_string(port) + "/chat/completions";
        config.api_key = "test-only";
        config.model = "mock";
        config.timeout_seconds = 1;
        const auto call = [&] { return LlmClient(config).generate("cpp", "什么是指针？", "指针保存地址。"); };
        auto result = call();
        check(result.generated && result.answer == "指针\nvector<int> 😀", "escaped Unicode and C++ templates survive JSON parsing");
        check(payload_valid, "model, messages, context request and authentication sent");
        for (int code : {1, 2, 3, 4, 5, 7, 8}) {
            scenario = code;
            result = call();
            check(!result.generated, "bad provider response returns fallback");
            if (code == 1) check(result.http_status == 402, "balance error preserves only HTTP status");
            if (code == 5) check(result.http_status == 302, "redirect is not followed");
        }
        scenario = 6;
        check(!call().generated, "slow provider request is bounded by timeout");
        scenario = 0;
        config.api_key.clear();
        check(call().reason == "not_configured", "missing key returns explicit fallback");
        config.api_key = "test-only";
        check(LlmClient(config).generate("cpp", "question", "").reason == "no_evidence", "empty evidence never calls provider");
        config.api_url = "http://example.com/chat/completions";
        check(call().reason == "invalid_config", "remote plaintext endpoint rejected");
        config.api_url = "https://user:password@example.com/chat/completions";
        check(call().reason == "invalid_config", "URL credentials rejected");
        const auto path = std::filesystem::temp_directory_path() / ("mzx-llm-" + std::to_string(GetCurrentProcessId()) + ".env");
        {
            std::ofstream file(path);
            file << "LLM_API_KEY=file-test-key\nLLM_API_URL=https://api.deepseek.com/chat/completions\nLLM_TIMEOUT_SECONDS=12\n";
        }
        // Tests run without reading the user's real .env.
        SetEnvironmentVariableW(L"LLM_API_KEY", L"process-test-key");
        check(LlmConfig::load(path).api_key == "process-test-key", "process key overrides file");
        SetEnvironmentVariableW(L"LLM_API_KEY", nullptr);
        SetEnvironmentVariableW(L"DEEPSEEK_API_KEY", L"alias-test-key");
        check(LlmConfig::load(path).api_key == "alias-test-key", "DEEPSEEK_API_KEY alias supported");
        SetEnvironmentVariableW(L"DEEPSEEK_API_KEY", nullptr);
        check(LlmConfig::load(path).api_key == "file-test-key", "existing .env key works without Python");
        SetEnvironmentVariableW(L"LLM_MODEL", nullptr);
        SetEnvironmentVariableW(L"DEEPSEEK_MODEL", L"remote-compatible-model");
        check(LlmConfig::load(path).model == "remote-compatible-model", "remote DEEPSEEK_MODEL setting remains supported");
        SetEnvironmentVariableW(L"DEEPSEEK_MODEL", nullptr);
        std::filesystem::remove(path);
    } catch (const std::exception &error) {
        std::cerr << "FAIL: " << error.what() << '\n';
        exit_code = 1;
    } catch (...) { std::cerr << "FAIL: unexpected exception\n"; exit_code = 1; }
    server.stop();
    worker.join();
    winrt::uninit_apartment();
    return exit_code;
}