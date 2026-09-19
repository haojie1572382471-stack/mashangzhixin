# 码上知新

RAG 驱动的编程查漏补缺与个性化复习助手。

## 项目定位

面向数据结构学习，以 C++ 示例辅助讲解和练习。

## 团队分工

- 我：C++ 后端、AI 接入、RAG 与数据处理。
- 队友：网页前端与交互。
- 共同：接口对接、测试和参赛材料。

## 当前进度

已完成第一个最小 C++ HTTP 后端：提供健康检查接口；尚未实现业务功能。

## 本地编译与运行

当前已验证环境：Windows、MSVC x64、CMake。

在已加载 MSVC x64 开发环境的终端中，
进入包含 CMakeLists.txt 的项目根目录，再执行：

```cmd
cmake -S . -B D:/mashang-build -G "NMake Makefiles"
cmake --build D:/mashang-build
D:\mashang-build\hello.exe
```

成功输出：

```text
Mashangzhixin: C++ is ready!
```

启动 HTTP 后端：

```cmd
D:\mashang-build\mashang_server.exe
```

服务启动后，在浏览器访问：

```text
http://127.0.0.1:8080/api/health
```

预期返回 HTTP 200 和以下 JSON。该接口需要在本地完成构建并启动后再验证，当前文档不将其写成已通过测试：

```json
{"status":"ok","message":"Mashangzhixin backend is running"}
```

停止服务时，在运行服务的终端按 `Ctrl+C`。

说明：
- `hello` 目标保留用于 C++ 环境检查。
- HTTP 后端使用 `third_party/cpp-httplib/` 中固定版本的官方库文件。
- 当前尚未验证 HTTP 接口的实际启动和浏览器响应。
- 本机使用 D:/mashang-build 保存构建产物，
  避开此前构建过程中出现的中文路径编码问题。
- 队友应根据自己的电脑选择可写的纯英文构建目录。