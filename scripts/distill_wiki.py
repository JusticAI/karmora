#!/usr/bin/env python3
"""
Wiki 蒸馏脚本 — 将 Reddit 社区 wiki 内容提炼成结构化发帖指南
输入: reddit_community_all_2026-05-09.json
输出: js/wiki_guides.json
"""

import json
import sys
import os
from datetime import datetime

INPUT = '/Users/clawuser/Downloads/reddit_community_all_2026-05-09.json'
OUTPUT = '/Users/clawuser/reddit-karma-landing/js/wiki_guides.json'
SAMPLE_FILE = '/tmp/wiki_sample_20.json'

# 蒸馏 Prompt 模板
DISTILL_PROMPT = """你是一个 Reddit 社区规则分析专家。根据以下社区的 wiki 内容和规则数据，提取出该社区的发帖指南。

社区: r/{name}
简介: {desc}
订阅数: {subscribers}

规则:
{rules_list}

Wiki 内容:
{wiki_content}

请输出 JSON 格式的发帖指南，包含以下字段（只输出 JSON，不要其他内容）：
{{
  "summary": "一句话总结该社区的核心调性和发帖要求",
  "allowed_topics": ["可以讨论的话题"],
  "banned_topics": ["禁止的话题"],
  "tone": "casual|professional|academic|humorous|supportive|strict",
  "formatting": {{
    "title_rules": "标题要求",
    "flair_required": true/false,
    "link_policy": "链接规则",
    "image_policy": "图片规则"
  }},
  "common_mistakes": ["新用户常犯的错误"],
  "newcomer_tips": ["给新用户的建议"],
  "risk_keywords": ["容易触发删帖/封禁的关键词"],
  "safe_alternatives": {{"风险词": "安全替代表达"}}
}}"""


def prepare_community_data(c):
    """准备单个社区的蒸馏输入数据"""
    about = c.get('about', {})
    rules = c.get('rules', [])
    wiki_content = c.get('wiki_content', {})
    
    # 格式化规则
    rules_text = ""
    for r in (rules or [])[:8]:
        name = r.get('short_name', r.get('name', ''))
        desc = r.get('description', '')[:200]
        rules_text += f"- {name}: {desc}\n"
    
    # 格式化 wiki 内容（排除 config 页面，截取关键内容）
    wiki_text = ""
    for page_name, page_data in (wiki_content or {}).items():
        if page_name.startswith('config/'):
            continue
        if page_name.startswith('automoderator'):
            continue
        content = ""
        if isinstance(page_data, dict):
            content = page_data.get('content', '')
        elif isinstance(page_data, str):
            content = page_data
        if content and len(content.strip()) > 10:
            wiki_text += f"\n### {page_name}\n{content[:600]}\n"
    
    if not wiki_text.strip():
        wiki_text = "(无 wiki 内容)"
    
    return {
        'name': c.get('name', ''),
        'desc': (about or {}).get('public_description', '')[:200],
        'subscribers': (about or {}).get('subscribers', 0) or 0,
        'rules_list': rules_text.strip(),
        'wiki_content': wiki_text[:3000],  # 限制总长度
    }


def build_prompt(community_data):
    """构建蒸馏 prompt"""
    return DISTILL_PROMPT.format(**community_data)


def rule_based_distill(c):
    """基于规则的简单蒸馏（不调用 LLM）"""
    about = c.get('about', {})
    rules = c.get('rules', [])
    wiki_content = c.get('wiki_content', {})
    name = c.get('name', '')
    
    # 从规则提取
    banned_topics = []
    risk_keywords = []
    common_mistakes = []
    
    for r in (rules or []):
        rname = (r.get('short_name', '') or '').lower()
        rdesc = (r.get('description', '') or '').lower()
        
        # 提取禁止话题
        if any(w in rname for w in ['no', 'banned', 'prohibited', 'not allowed']):
            banned_topics.append(r.get('short_name', ''))
        
        # 提取风险关键词
        if 'spam' in rdesc: risk_keywords.append('spam')
        if 'self-promo' in rdesc or 'self promo' in rdesc: risk_keywords.append('self-promotion')
        if 'affiliate' in rdesc: risk_keywords.append('affiliate links')
        if 'beg' in rdesc or 'asking for' in rdesc: risk_keywords.append('begging/asking')
        if 'low effort' in rdesc or 'low-effort' in rdesc: risk_keywords.append('low-effort content')
        if 'repost' in rdesc: risk_keywords.append('reposts')
        if 'off-topic' in rdesc or 'off topic' in rdesc: risk_keywords.append('off-topic content')
        if 'nsfw' in rdesc: risk_keywords.append('NSFW content')
        if 'politic' in rdesc: risk_keywords.append('political content')
        if 'meme' in rdesc and 'no' in rdesc: risk_keywords.append('memes')
        if 'link' in rdesc and ('no' in rdesc or 'only' in rdesc): risk_keywords.append('external links')
    
    # 从 wiki 提取调性
    all_wiki = ""
    for page_name, page_data in (wiki_content or {}).items():
        if page_name.startswith('config/'):
            continue
        content = ""
        if isinstance(page_data, dict):
            content = page_data.get('content', '')
        elif isinstance(page_data, str):
            content = page_data
        all_wiki += content.lower() + " "
    
    tone = 'casual'
    if any(w in all_wiki for w in ['academic', 'scholarly', 'peer-reviewed', 'citation']):
        tone = 'academic'
    elif any(w in all_wiki for w in ['professional', 'industry', 'career']):
        tone = 'professional'
    elif any(w in all_wiki for w in ['meme', 'shitpost', 'funny', 'lol']):
        tone = 'humorous'
    elif any(w in all_wiki for w in ['support', 'safe space', 'help', 'recovery']):
        tone = 'supportive'
    elif any(w in all_wiki for w in ['strict', 'zero tolerance', 'immediate ban']):
        tone = 'strict'
    
    # 格式要求
    flair_required = 'flair' in all_wiki and ('required' in all_wiki or 'must' in all_wiki)
    link_policy = 'neutral'
    if any(w in all_wiki for w in ['no link', 'no url', 'no external']):
        link_policy = 'no_links'
    elif any(w in all_wiki for w in ['only link', 'must include']):
        link_policy = 'links_required'
    
    # 新用户建议
    if any(w in all_wiki for w in ['faq', 'read the']):
        common_mistakes.append('没有先读 FAQ')
        newcomer_tips = ['发帖前先读 FAQ 和社区规则']
    else:
        newcomer_tips = ['先潜水观察社区氛围再发帖']
    
    if flair_required:
        common_mistakes.append('忘记选择 flair')
        newcomer_tips.append('发帖时选择正确的 flair')
    
    if any(w in all_wiki for w in ['search before', 'check previous', 'use the search']):
        common_mistakes.append('重复提问已有答案的问题')
        newcomer_tips.append('发帖前搜索是否已有类似讨论')
    
    # 生成总结
    desc = (about or {}).get('public_description', '')[:100]
    summary = f"r/{name}: {desc}"
    if tone == 'strict':
        summary += "（严格管理，务必遵守规则）"
    
    return {
        'community': name,
        'distilled_at': datetime.now().strftime('%Y-%m-%d'),
        'method': 'rule_based',
        'posting_guide': {
            'summary': summary,
            'allowed_topics': [],
            'banned_topics': banned_topics[:5],
            'tone': tone,
            'formatting': {
                'title_rules': '',
                'flair_required': flair_required,
                'link_policy': link_policy,
                'image_policy': ''
            },
            'common_mistakes': common_mistakes,
            'newcomer_tips': newcomer_tips,
            'risk_keywords': list(set(risk_keywords)),
            'safe_alternatives': {}
        }
    }


# === 主流程 ===
if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sample'
    
    print(f"📂 读取 {INPUT} ...")
    with open(INPUT, 'r') as f:
        data = json.load(f)
    
    communities = [c for c in data.get('communities', []) if c is not None]
    with_wiki = [c for c in communities if c.get('wiki_content')]
    print(f"✅ 共 {len(communities)} 社区，{len(with_wiki)} 有 wiki 内容")
    
    if mode == 'sample':
        # 20 个样本测试
        import random
        random.seed(42)
        targets = random.sample(with_wiki, min(20, len(with_wiki)))
        print(f"\n🧪 样本模式: {len(targets)} 个社区")
    elif mode == 'all':
        targets = with_wiki
        print(f"\n🚀 全量模式: {len(targets)} 个社区")
    else:
        # 指定社区名
        targets = [c for c in communities if c.get('name') == mode]
        if not targets:
            print(f"❌ 找不到社区: {mode}")
            sys.exit(1)
    
    # 蒸馏
    guides = []
    for i, c in enumerate(targets):
        guide = rule_based_distill(c)
        guides.append(guide)
        if (i + 1) % 100 == 0:
            print(f"   已处理 {i + 1}/{len(targets)}")
    
    # 输出
    print(f"\n📝 写入 {OUTPUT} ...")
    with open(OUTPUT, 'w') as f:
        json.dump(guides, f, ensure_ascii=False, indent=2)
    
    # 统计
    tones = {}
    for g in guides:
        t = g['posting_guide']['tone']
        tones[t] = tones.get(t, 0) + 1
    
    has_risk = sum(1 for g in guides if g['posting_guide']['risk_keywords'])
    
    print(f"✅ 完成! {len(guides)} 个社区发帖指南")
    print(f"\n  调性分布:")
    for t, count in sorted(tones.items(), key=lambda x: -x[1]):
        print(f"    {t}: {count}")
    print(f"\n  有风险关键词: {has_risk}/{len(guides)}")
    
    # 显示样本
    if mode == 'sample':
        print(f"\n📋 样本输出:")
        for g in guides[:3]:
            pg = g['posting_guide']
            print(f"\n  r/{g['community']}:")
            print(f"    调性: {pg['tone']}")
            print(f"    风险词: {pg['risk_keywords']}")
            print(f"    常见错误: {pg['common_mistakes']}")
            print(f"    新手建议: {pg['newcomer_tips']}")
