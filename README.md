# 码上知新

面向 C++ 与数据结构学习的课程答疑、错题整理与复习助手。

GitHub 仓库：https://github.com/haojie1572382471-stack/mashangzhixin

## 工作目录与课程标识

本机仓库：`D:\Program Files\码上新智\mashangzhixin`。
导出文档：`D:\Program Files\码上新智\文档`。
GitHub Desktop 应添加新的仓库路径，分支为 `feature/llm-rag-generation`。

| 页面显示 | course_id | 知识库目录 |
| --- | --- | --- |
| C++程序设计 | cpp | knowledge_base/cpp |
| 数据结构 | data-structure | knowledge_base/data_structure |

`C++` 是显示名称，内部标识必须是 `cpp`，不可改成 `c++`。

## 当前架构

浏览器 → C++ HTTP 服务（8080）→ Markdown 课程资料检索 → C++ WinHTTP → DeepSeek。

后端、模型请求和模型响应解析均为 C++。Windows 自带 WinHTTP 负责 HTTPS，
Windows Runtime JSON 通过 C++/WinRT 解析完整 JSON（含中文转义和 Unicode 代理对）。
运行和测试均不依赖 Python，也不需要 8081 网关。

- 检索结果作为模型上下文，来源由后端保留和展示。
- 没有证据时不调用模型；缺少密钥、超时、接口报错、响应异常时返回资料摘录。
- 保留错题持久化、掌握状态、固定题库推荐和答案判定。
- 来源代表提交给模型的参考片段，尚未做逐句引用校验。
- 仍待实现：向量检索、流式输出、作答记录驱动的薄弱点诊断。
- 前端部分辅助页面仍有演示逻辑，不能将全部图表视为真实学习数据。

## 环境与编译

Windows 10/11、Visual Studio C++ 桌面开发组件、Windows SDK（含 C++/WinRT）、CMake/Ninja。
本项目使用 C++20。cpp-httplib 已随仓库提供，许可证见 third_party/cpp-httplib。

在项目根目录执行：

```powershell
Set-Location "D:\Program Files\码上新智\mashangzhixin"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

脚本自动加载 x64 编译环境，生成 `build/app/mashang_server.exe` 及 C++ 测试程序。
不要再启动其他旧目录中的 exe；它们可能占用 8080，让网页访问到旧版本。

## 模型配置

复制 `.env.example` 为 `.env`。已有 `.env` 会继续生效，无需重新复制或改名：

```dotenv
LLM_API_URL=https://api.deepseek.com/chat/completions
LLM_MODEL=deepseek-flash
LLM_API_KEY=你的API密钥
LLM_TIMEOUT_SECONDS=30
LLM_THINKING=disabled
```

也兼容进程环境变量 `DEEPSEEK_API_KEY`。密钥优先级为：非空进程 `LLM_API_KEY` →
非空进程 `DEEPSEEK_API_KEY` → `.env` 的 `LLM_API_KEY` → `.env` 的 `DEEPSEEK_API_KEY`。
模型名称同样兼容 `DEEPSEEK_MODEL`：非空进程 LLM_MODEL → 非空进程 DEEPSEEK_MODEL → .env 的 LLM_MODEL → .env 的 DEEPSEEK_MODEL → 默认模型。其他设置优先使用非空进程环境变量，再读取 `.env`。
修改配置后重启后端。密钥不得提交，`.env` 已被 Git 忽略。

超时配置支持 1—45 秒；WinHTTP 使用阶段超时，程序还会检查响应读取预算。
远程接口要求 HTTPS并正常校验证书；HTTP 仅允许本机测试。不会跟随重定向发送密钥。
DeepSeek 默认使用非思考模式；切换其他服务商时，不支持 thinking 参数则清空 LLM_THINKING。
[DeepSeek 参数说明](https://api-docs.deepseek.com/guides/thinking_mode/)。

## 启动和真实 API 测试

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

打开 http://127.0.0.1:8080/#qa ，按 Ctrl+C 停止服务。
只启动一个 C++ 后端。后端直接提供 frontend 目录，不对外提供 .env 或 data 文件。
当前服务仅监听本机，尚无公网部署或真正的多用户隔离。

单独验证真实模型（会发送一条简短请求，按服务商规则计费）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-api.ps1
```

底层执行 `build/app/mashang_server.exe --test-api`。只报告成功或错误代码，不打印密钥。
HTTP 401 表示鉴权问题，402 表示余额不足，429 表示限流。

## 接口

| 接口 | 用途 |
| --- | --- |
| GET /api/health | 健康检查 |
| POST /api/ask | 检索与模型讲解 |
| GET /api/wrong-questions | 查询错题 |
| POST /api/wrong-questions | 保存错题 |
| PUT /api/wrong-questions/{id}/status | 更新掌握状态 |
| GET /api/recommendations | 获取题库推荐 |
| POST /api/exercises/submit | 提交答案 |

```json
{"course_id":"cpp","question":"C++中的指针和引用有什么区别？"}
```

答疑返回 `answer`、`sources`、`mode`、`notice`：
`generated` 表示模型生成；`retrieval` 表示回退资料摘录；`no_evidence` 表示没有足够资料。
只看到 answer 和 sources 不足以证明真实模型调用成功，应检查 mode。

## 本地测试

先编译，关闭占用 8080 的后端，然后执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

C++ 测试在随机本地端口模拟模型，检查请求字段、中文 JSON、截断/空响应、超时、HTTP 错误、
重定向拒绝、缺少密钥与配置优先级。PowerShell 隔离接口测试验证检索回退、无依据回答、
错题和掌握状态重启恢复、推荐、判题、静态页面以及密钥文件不可访问。
测试不调用付费模型，临时错题数据写在 build 下，不修改现有学习记录。

## 团队与参赛

主要开发负责后端、AI 接入、联调和部署；队友负责课程资料、测试题、体验回归和参赛材料。
正式提交前补齐团队姓名、学校、组别与指导老师信息。
