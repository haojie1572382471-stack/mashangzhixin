# 学习记录、身份与掌握度

## 身份和历史数据

前端账号通过 /api/auth/register、/login 获得HttpOnly会话Cookie，服务端生成随机稳定用户ID。/api/progress、推荐、提交和错题接口均从会话取得身份，user_id字段只作兼容一致性检查，不能用来读取他人数据。密码使用独立随机盐和600000轮PBKDF2-HMAC-SHA256，不保存明文。会话在内存中保存12小时，退出撤销，服务重启后重新登录。

原来的用户名分组记录保留在文件中，新注册同名账号不能自动取得这些记录。旧本机账号需重新注册；本机资料缓存只保留头像、签名等非认证数据。访客guest是公开共享演示身份。原错题没有user_id时归属guest。公开部署前必须改为HTTPS并设置Secure Cookie。

## 持久化

作答写入data/learning_attempts.json。字段包括服务端用户ID、题号、课程、知识点、选择、对错、UTC时间及submission_id。写入顺序为临时文件、FlushFileBuffers、旧版本备份、原子替换。失败时回滚内存并返回500。同一个用户的同一submission_id重复请求返回reused=true、recorded=false和原attempt_id；相同提交号但答案或题目不一致返回409。

学习文件损坏时尝试.bak；该备份可能少最后一条记录，恢复会在启动日志提示。两个文件都损坏则拒绝启动。账号文件独立保存密码哈希，损坏时同样拒绝启动；应定期做项目外的数据备份。

## 指标

- total_attempts、correct_attempts、accuracy：所有成功保存的有效作答，包含重复练习。
- unique_exercises：该知识点答过的不同题目数。
- first_attempt_accuracy：每道不同题的首次作答正确率，不会因刷题被改写。
- mastery：最多20道不同题各自最近一次作答的正确率；重复同题只替换该题结果，不重复增加权重。
- 未学习：没有记录；待加强：mastery低于60%；已掌握：至少覆盖3道不同题且mastery不低于80%；其余为学习中。
- last_attempted_at：最后作答UTC时间。
- 课程mastery：10个知识点的掌握度平均值，未学计0。它同时反映覆盖程度，与总体正确率不同。

这些是可解释的练习表现估计，不是经心理测量验证的能力诊断。当前每个知识点仅3题，题库扩充后才适合更细的能力判断。

## 推荐与辅导

普通推荐每次最多10题；已作答且mastery低于60%的知识点优先，分数越低越靠前，同优先级随机。同知识点最多3题。无历史记录时随机推荐。未找到指定知识点时仍保留课程内回退并提示。

/api/exercises/coach仅接受当前身份已提交过的题号，从服务端读取最近选择、标准答案与解析，以知识点检索资料。模型仅负责解释可能误区与复习步骤，不参与判分。无资料或无模型时返回标准解析。verification_exercise_id指定另一道真实同知识点题；前端验证环节排除刚讲解的题。

来源展示表示该资料被用于上下文，不代表逐句事实校验已完成。当前模型响应不是流式，也不能声称运行过用户代码。

## 验收

运行tests/learning_progress_api.cjs和tests/hardening_acceptance.cjs。覆盖账号/课程隔离、越权阻止、注销失效、重启登录、错题权限、幂等提交、并发、损坏恢复、刷同题不能已掌握、辅导回退和浏览器完整流程。运行scripts/test.ps1保留原有模型失败回退和错题等回归验证。

实现参考：[Microsoft CNG PBKDF2 API](https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptderivekeypbkdf2)、[OWASP密码存储指南](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。选用Windows自带CNG以避免额外密码学依赖；并不因此声称本项目取得了任何安全认证。
