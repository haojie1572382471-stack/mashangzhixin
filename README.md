# 码上知新

面向 C++ 与数据结构学习的课程答疑、错题整理与复习助手。

## 当前实现

- Markdown 课程资料分块、关键词评分检索及来源返回。
- 检索片段作为上下文，由可配置的 Chat Completions 兼容模型生成讲解。
- 没有相关资料时不调用模型；未配置模型或调用失败时明确显示“资料摘录”。
- 错题保存、掌握状态修改及本地文件持久化。
- 固定题库按课程和知识点推荐练习，服务端判题。
- 页面区分 AI 讲解、资料摘录、资料不足和演示数据；演示答案不可保存。

尚未实现：向量检索、流式输出、AI 自动出题、基于作答记录的薄弱点诊断。
前端其他页面仍包含演示逻辑，不能将全部图表或账户功能视为真实后端能力。

## 架构

浏览器 → C++ HTTP 服务（8080）→ 本地 Markdown 检索
→ Python 模型网关（仅监听 127.0.0.1:8081）→ 配置的模型服务。

C++ 保留业务与检索逻辑；Python 标准库负责 HTTPS、模型 JSON 解析和密钥配置，免装 pip 包。
检索来源由 C++ 返回，不采信模型自行编造的引用。当前来源代表提供给模型的参考片段，
并非已经逐句验证的答案依据。Prompt 包含资料不足说明和忽略资料内指令的要求，仍需人工评测。

## 环境

- Windows，Visual Studio C++ 桌面开发工具及其 CMake/Ninja 组件。
- Python 3.9+，终端可执行 python。
- 已包含固定版本 cpp-httplib，许可证见 third_party/cpp-httplib。
- PowerShell，执行下列命令时位于本项目根目录。

## 编译

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

脚本自动定位 Visual Studio 并加载编译环境，使用 Ninja Release 构建，
产物为 build/app/mashang_server.exe。旧版 D:/mashang-build 不再用于此脚本。

## 配置模型

将 .env.example 复制为项目根目录的 .env（已有文件请直接编辑，不要覆盖）。
填写以下三项：

```dotenv
LLM_API_URL=https://你的服务商提供的完整接口地址/chat/completions
LLM_MODEL=你的模型名称
LLM_API_KEY=你的API密钥
LLM_TIMEOUT_SECONDS=30
```

接口地址须使用该服务商支持的完整 Chat Completions 路径，不要填写控制台网址。
远程地址要求 HTTPS；仅本机测试允许 HTTP。默认等待 30 秒，可设置 1—45 秒。
系统环境变量优先于 .env，修改后重启服务生效。密钥只由本地网关读取，禁止提交到仓库。
.env 已由 .gitignore 忽略，.env.example 不包含密钥。

未填写配置也可以启动，此时显示真实检索资料摘录，不冒充 AI 生成。
启用模型后，问题和检索到的课程片段会发送到所配置的模型服务；使用适合外发的资料。

## 启动

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

浏览器打开 http://127.0.0.1:8080/#qa 。无需另外启动 Live Server。
脚本同时启动模型网关和 C++ 后端，按 Ctrl+C 结束；若端口占用，先关闭旧实例。
网页仅由 frontend 目录提供，密钥与错题文件不在静态资源目录内。
当前监听本机地址，尚未提供公网部署和真正的多用户隔离。

## 接口

| 接口 | 用途 |
| --- | --- |
| GET /api/health | 健康检查 |
| POST /api/ask | 课程检索及模型讲解 |
| GET /api/wrong-questions | 查询错题 |
| POST /api/wrong-questions | 保存错题 |
| PUT /api/wrong-questions/{id}/status | 更新掌握状态 |
| GET /api/recommendations | 获取题库推荐 |
| POST /api/exercises/submit | 提交答案 |

课程标识为 cpp 或 data-structure。答疑请求：

```json
{"course_id":"cpp","question":"指针与引用有什么区别？"}
```

响应保留 answer、sources，新增 mode 和 notice：

- generated：模型生成完成。
- retrieval：资料摘录，notice 说明未配置或服务不可用。
- no_evidence：没有足够相关资料，未调用模型。

模型网关故障不会清空检索来源或错题数据。保存位置为 data/wrong_questions.json。

## 验证

先完成编译，关闭占用 8080、8081 的项目实例，再运行：

```powershell
python -m unittest discover -s tests -v
```

测试使用本地模拟模型，不需要真实密钥，不调用付费 API。
覆盖生成与上下文传递、异常响应、限流、超时、缺少配置、配置优先级、
不安全地址拒绝，以及 C++ 接口联调、无依据回答、错题重启恢复、静态入口和密钥路径不可访问。
测试在临时目录写入错题，不修改现有学习记录。

实际服务商连通性、真实模型讲解质量仍需填写配置后验证。

## 团队分工与下一步

- 主要开发：后端、AI 接入、前后端联调与部署。
- 队友：整理有来源的课程资料、测试题、操作回归、用户反馈与参赛材料。
- 下一步：用测试题评估回答与引用质量，再增加基于作答证据的薄弱点分析和复习验证。
- 正式提交前补齐团队姓名、学校、组别及指导教师信息。
