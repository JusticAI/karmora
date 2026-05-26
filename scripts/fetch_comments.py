#!/usr/bin/env python3
"""
Karmora 高赞评论采集脚本
从 PullPush API 批量采集各社区 Top 评论
用于社区风格蒸馏
"""

import json
import os
import time
import urllib.request
from datetime import datetime

# 配置
DATA_JS_PATH = os.path.expanduser("~/reddit-karma-landing/js/data.js")
POSTS_DATA_PATH = os.path.expanduser("~/reddit-karma-landing/data/posts_by_community.json")
OUTPUT_PATH = os.path.expanduser("~/reddit-karma-landing/data/comments_by_community.json")
COMMENTS_PER_SUB = 50  # 每个社区采集评论数
DELAY = 1.5

def extract_communities():
    """从 data.js 提取社区列表"""
    import re
    with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    names = re.findall(r'name:\s*["\'](\w+)["\']', content)
    return list(dict.fromkeys(names))

def fetch_top_comments(subreddit):
    """获取社区高赞评论"""
    url = (
        f"https://api.pullpush.io/reddit/search/comment/"
        f"?subreddit={subreddit}&sort=score&order=desc&size={COMMENTS_PER_SUB}"
    )
    headers = {"User-Agent": "KarmoraResearch/1.0"}
    req = urllib.request.Request(url, headers=headers)
    
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data.get("data", [])
        except Exception as e:
            if attempt < 2:
                print(f"  ⚠️ 重试 {attempt+1}: {e}")
                time.sleep(2)
            else:
                print(f"  ❌ 失败: {e}")
                return []

def main():
    print("=" * 50)
    print("🚀 Karmora 高赞评论采集脚本")
    print("=" * 50)
    
    communities = extract_communities()
    print(f"\n📋 共 {len(communities)} 个社区待采集\n")
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    all_data = {}
    success_count = 0
    fail_count = 0
    
    for i, sub in enumerate(communities, 1):
        print(f"[{i}/{len(communities)}] r/{sub} ... ", end="", flush=True)
        
        comments = fetch_top_comments(sub)
        
        if comments:
            clean_comments = []
            for c in comments:
                body = (c.get("body", "") or "")
                if body in ["[deleted]", "[removed]", ""]:
                    continue
                clean_comments.append({
                    "id": c.get("id", ""),
                    "author": c.get("author", ""),
                    "body": body[:500],
                    "score": c.get("score", 0),
                    "created_utc": c.get("created_utc", 0),
                    "created_date": datetime.fromtimestamp(c.get("created_utc", 0)).strftime("%Y-%m-%d") if c.get("created_utc") else "",
                    "permalink": f"https://reddit.com{c.get('permalink', '')}",
                    "link_id": c.get("link_id", ""),
                })
            
            # 按 score 排序
            clean_comments.sort(key=lambda x: x["score"], reverse=True)
            
            all_data[sub] = {
                "count": len(clean_comments),
                "avg_score": sum(c["score"] for c in clean_comments) / len(clean_comments) if clean_comments else 0,
                "max_score": max(c["score"] for c in clean_comments) if clean_comments else 0,
                "comments": clean_comments
            }
            print(f"✅ {len(clean_comments)} 条 (最高 {all_data[sub]['max_score']}↑)")
            success_count += 1
        else:
            all_data[sub] = {"count": 0, "comments": [], "error": "fetch_failed"}
            print("❌ 无数据")
            fail_count += 1
        
        if i < len(communities):
            time.sleep(DELAY)
    
    # 保存
    output = {
        "meta": {
            "total_communities": len(communities),
            "success": success_count,
            "failed": fail_count,
            "comments_per_sub": COMMENTS_PER_SUB,
            "collected_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
        "communities": all_data
    }
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 50)
    print(f"✅ 采集完成!")
    print(f"   成功: {success_count} 社区")
    print(f"   失败: {fail_count} 社区")
    print(f"   保存至: {OUTPUT_PATH}")
    print("=" * 50)

if __name__ == "__main__":
    main()
