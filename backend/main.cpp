#include <httplib.h>

#include <iostream>

int main() {
    httplib::Server server;

    server.Get("/api/health", [](const httplib::Request &, httplib::Response &response) {
        response.set_content(
            R"({"status":"ok","message":"Mashangzhixin backend is running"})",
            "application/json");
    });

    std::cout << "Mashangzhixin backend listening at http://127.0.0.1:8080/api/health"
              << std::endl;

    if (!server.listen("127.0.0.1", 8080)) {
        std::cerr << "Failed to listen on http://127.0.0.1:8080" << std::endl;
        return 1;
    }

    return 0;
}