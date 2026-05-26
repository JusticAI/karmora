# Karmora — Reddit Karma 策略平台

> 基于 5,539 个 Reddit 社区的深度数据分析，帮你安全度过 Reddit 冷启动期。

🔗 **在线访问**: https://reddit-karma-landing.vercel.app

---

## 核心功能

### 📊 社区数据库
5,539 个 Reddit 社区的完整数据，支持搜索、筛选、排序。
- 29 个分类标签（电商、科技、游戏、生活...）
- 订阅数、活跃度、质量评级
- 社区规则全覆盖（5,265 个社区）

### 🎯 智能匹配
描述你想做的事，系统从 5,539 个社区中找到最适合你的。
- 意图识别 + 关键词匹配
- 匹配度评分 + 推荐理由
- 支持中英文输入

### 🛡️ 规则检查器
粘贴帖子内容，检测是否违反目标社区规则。
- **23,180 条社区规则**深度匹配
- **1,529 个社区**的 Wiki 发帖指南
- 风险评分（0-100）+ 修复建议
- 全局模式检测（链接、推广词、CTA、索赞等）

### 🗺️ 路径规划
根据你的 Karma 和账号年龄，生成个性化增长路径。

---

## 数据规模

| 数据 | 数量 |
|------|------|
| 社区总数 | 5,539 |
| 有规则的社区 | 5,265（95%） |
| 规则总数 | 23,180 |
| Wiki 发帖指南 | 1,529 |
| 有 about 数据 | 5,437 |

---

## 项目结构

```
reddit-karma-landing/
├── index.html              # 首页
├── communities.html        # 社区数据库
├── match.html              # 智能匹配
├── assistant.html          # 规则检查器
├── dashboard.html          # 路径规划
├── js/
│   ├── config.js           # 数据源配置
│   └── data.js             # 备用本地数据
├── data/
│   ├── communities.json    # 完整数据（6.4MB）
│   ├── communities-index.json  # 轻量索引（1.6MB）
│   ├── posts_by_community.json
│   └── comments_by_community.json
├── scripts/                # 数据采集脚本
├── collector-extension/    # Reddit 采集 Chrome 扩展
└── database/               # Supabase schema（已弃用）
```

---

## 数据源

社区数据托管在独立仓库：[JusticAI/karmora-data](https://github.com/JusticAI/karmora-data)

前端通过 jsdelivr CDN 加载数据：
```
https://cdn.jsdelivr.net/gh/JusticAI/karmora-data@main/communities-index.json
```

| 文件 | 说明 | 大小 |
|------|------|------|
| `communities-index.json` | 轻量索引（列表/搜索/匹配用） | ~1.6MB |
| `communities.json` | 完整数据（含规则详情） | ~6.4MB |
| `wiki_guides.json` | Wiki 发帖指南（1,529 社区） | ~500KB |
| `posts_by_community.json` | 帖子样本数据 | ~5.5MB |
| `comments_by_community.json` | 评论样本数据 | ~3.7MB |

---

## 部署

本项目是纯静态站点，部署在 Vercel：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

无需构建步骤，无需后端服务。

---

## 数据采集

社区数据通过 Reddit API 采集，脚本在 `scripts/` 目录：

```bash
# 采集社区列表
node scripts/collect_all_communities.js

# 采集社区详情（规则、about）
node scripts/collect_community_details_v7.js

# 生成 Wiki 发帖指南
python3 scripts/distill_wiki.py all
```

采集使用 Chrome 扩展 `collector-extension/`，支持三阶段采集：
1. 基础信息 + 规则
2. 版主 + 提交指南
3. Wiki 内容

---

## 技术栈

- **前端**: 纯 HTML/CSS/JS（无框架）
- **数据源**: GitHub + jsdelivr CDN
- **部署**: Vercel（静态站点）
- **数据采集**: Node.js + Python + Chrome 扩展

---

## 许可

© 2026 Karmora — 基于 Reddit 公开数据的 Karma 策略平台

Karmora 与 Reddit 无关。所有分析基于公开可用数据。
