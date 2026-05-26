# 个人简历

**罗学森**

## 联系方式
- 邮箱：lawsonsylvan@outlook.com
- 电话：13189346302
- GitHub：https://github.com/JusticAI

---

## 项目经验

### Karmora — Reddit Karma 策略分析平台
**角色：独立产品经理 + 全栈开发者** | 2026

一个面向 Reddit 运营者的社区数据平台，帮助用户发现高潜力社区、制定内容策略。

**核心工作：**

- **产品定义与规划：** 从0到1完成产品定位——面向 Reddit 运营者提供数据驱动的社区选品工具。自主完成竞品分析、用户画像、需求优先级排序，定义 MVP 范围。
- **数据采集系统设计：** 主导开发 Chrome 扩展，自动化采集 Reddit 社区数据。通过绕过 API 限制的巧妙方案（利用用户浏览器身份 + 同源请求），实现 **5539 个社区的基础信息+规则+Wiki 全量采集，完成率 99.5%**。
- **AI 驱动开发（Vibe Coding）：** 全程使用 AI Agent（Claude、XiaomiMimo、DeepSeek 等多模型协作）辅助开发，从架构设计、代码生成到 Debug 实现端到端交付。项目从构思到上线高度依赖 AI 协作，是 Vibe Coding 模式的完整实践。
- **全栈实现：** 前端（Landing Page + Dashboard）→ 后端 API（Vercel Serverless）→ 数据库设计（Supabase PostgreSQL）→ 部署上线。独立处理 3 表关系设计、RLS 权限策略、内测申请审批流。
- **产品运营闭环：** 设计并落地完整的用户转化漏斗：访客 → 提交内测申请 → 后台审核 → 邮箱审批链接 → Beta 用户。实现 Admin 面板用于审核管理，附带批量审批功能。
- **产品迭代与架构升级：** 基于内测反馈推动产品路线图迭代。将初始的 localStorage 原型升级为 Supabase + Vercel Serverless 生产架构，引入 RLS 权限策略、Token 登录验证、审核流等产品化能力，完成 Demo 到可用产品的跃迁。整个升级过程中保持零停機、用户无缝过渡。

**关键成果：**
- 完成 5539 个社区的结构化数据采集与存储
- 平台具备 E2E 的用户申请→审批→使用流程
- 完成从本地原型到 Serverless 架构的技术升级，用户无缝迁移
- AI 协作产出代码占比 >80%，验证了 Vibe Coding 在真实产品开发中的可行性

---

### Auto-Debug 智能错误监控系统
**角色：独立产品经理 + 开发者** | 2026

在 Karmora 项目开发过程中，"Vibe" 出的 AI 自动化 Debug 工具。

**背景：** Chrome 扩展在无头环境运行时会产生大量错误日志，人工排查效率极低。需要一个**自愈型**的错误监控方案。

**核心工作：**

- **问题识别与方案设计：** 识别到传统日志排查的痛点——错误产生频率高、类型重复、需要人工介入。设计方案：自动捕获 → 去重指纹 → AI 分析 → 静默或告警 → 自愈。
- **AI 辅助开发：** 用 AI Agent 设计错误指纹去重算法（基于错误堆栈+信息摘要生成 SHA-256 指纹），避免同一类错误重复分析浪费 token。
- **跨系统集成：** 在 Chrome 扩展 content script 中注入 ErrorMonitor 类，利用 chrome.runtime.sendMessage 将错误报告传输到 background.js，通过 chrome.downloads 持久化到本地。配套 Python 检查脚本定时扫描错误文件，通过 cron 调度 AI Agent 自动分析。
- **成本意识设计：** 无错误时 0 token 消耗（静默跳过），有错误时才触发 AI 分析并告警。仅错误时通知，避免不必要的噪音。
- **持续优化迭代：** 根据 Chrome MV3 限制持续优化架构——从 content script 直接写文件改为 sendMessage 中转 → background.js → chrome.downloads，解决 Service Worker 无 DOM 访问的兼容问题。

**关键成果：**
- 实现完全自动化的错误采集 → 去重 → 分析 → 告警闭环
- 运行模式为「部署后无需人工干预」，符合真实生产环境要求
- 证明 AI Agent 不仅可用于代码生成，也可用于产线运维监控

---

### Chrome 翻译插件
**角色：产品经理 + 开发者** | 2026

一个轻量级的网页翻译 Chrome 扩展，支持懒加载翻译和 MutationObserver 动态内容适配。

- 使用 Google Translate API 实现页面级翻译
- 设计 MutationObserver 方案自动翻译动态加载的内容（SPA 兼容）
- GitHub: https://github.com/luoxuesen/chrome-translator-extension

---

## 核心能力

| 领域 | 能力 |
|------|------|
| **AI 应用** | LLM Agent 协作开发（Vibe Coding）、AI Agent 自动化运维、Prompt Engineering |
| **产品设计** | 从0到1产品规划、竞品分析、用户漏斗设计、需求优先级管理 |
| **技术实现** | Chrome 扩展开发（MV3）、Supabase/Firebase、Vercel Serverless、React/HTML/CSS |
| **数据分析** | Reddit 社区数据采集与分析、数据驱动决策 |
| **工具链** | Git、Supabase Studio、Chrome DevTools、AI 辅助开发全流程 |

## 荣誉与资质
- **小米 Mimo Orbit 百万亿 Token 创造者激励计划** 入选者

## 教育背景
- 本科 广东省肇庆学院


---

*注：以上项目均为独立完成，充分体现了在 AI 辅助下「一个人的产品团队」的交付能力。*
