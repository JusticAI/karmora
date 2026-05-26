# Wiki Skill — Reddit 社区规则蒸馏器

## 目的
将 Reddit 社区的 wiki 内容 + 规则数据，蒸馏成结构化的「发帖指南」，
供 Karmora 规则检查器实时匹配用户帖子。

## 输入格式
```json
{
  "name": "社区名",
  "title": "社区标题",
  "desc": "社区简介",
  "subscribers": 12345,
  "rules": [
    { "name": "规则名", "desc": "规则描述", "severity": "ban|warning|info" }
  ],
  "wiki_content": {
    "page_name": "wiki 页面内容（markdown）"
  }
}
```

## 输出格式
```json
{
  "community": "社区名",
  "distilled_at": "2026-05-09",
  "posting_guide": {
    "summary": "一句话总结该社区的核心调性和发帖要求",
    "allowed_topics": ["可以讨论的话题1", "话题2"],
    "banned_topics": ["禁止的话题1", "话题2"],
    "tone": "casual|professional|academic|humorous|supportive",
    "formatting": {
      "title_rules": "标题要求",
      "flair_required": true/false,
      "link_policy": "链接规则",
      "image_policy": "图片规则"
    },
    "common_mistakes": [
      "新用户常犯的错误1",
      "错误2"
    ],
    "newcomer_tips": [
      "给新用户的建议1",
      "建议2"
    ],
    "risk_keywords": ["容易触发删帖的关键词1", "关键词2"],
    "safe_alternatives": {
      "风险词1": "安全替代表达1",
      "风险词2": "安全替代表达2"
    }
  }
}
```

## 蒸馏 Prompt

```
你是一个 Reddit 社区规则分析专家。根据以下社区的 wiki 内容和规则数据，
提取出该社区的发帖指南。

社区: r/{name}
简介: {desc}
订阅数: {subscribers}

规则:
{rules_list}

Wiki 内容:
{wiki_content}

请输出 JSON 格式的发帖指南，包含以下字段：
- summary: 一句话总结
- allowed_topics: 可以讨论的话题列表
- banned_topics: 禁止的话题列表
- tone: 社区调性
- formatting: 格式要求（标题、flair、链接、图片政策）
- common_mistakes: 新用户常犯错误
- newcomer_tips: 给新用户的建议
- risk_keywords: 容易触发删帖/封禁的关键词
- safe_alternatives: 风险词的安全替代表达

只输出 JSON，不要其他内容。
```

## 使用方式

### 1. 预处理（批量蒸馏）
```bash
python3 scripts/distill_wiki.py
# 输出: js/wiki_guides.json
```

### 2. 运行时匹配
```javascript
// 用户输入帖子内容 + 选择社区
const guide = WIKI_GUIDES[communityName];
// 匹配 risk_keywords
// 返回违规点 + safe_alternatives
```

## 文件结构
```
scripts/
  distill_wiki.py          # 蒸馏脚本（调用 LLM）
js/
  data.js                  # 社区基础数据
  wiki_guides.json         # 蒸馏后的发帖指南
```
