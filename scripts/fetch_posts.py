#!/usr/bin/env python3
"""
Karmora 帖子采集脚本
从 PullPush API 批量采集各社区帖子
按社区分类 → 按时间排序 → 每个时间段内按 upvote/comment 降序
"""

import json
import re
import time
import urllib.request
import urllib.error
import os
from datetime import datetime

# 配置
DATA_JS_PATH = os.path.expanduser("~/reddit-karma-landing/js/data.js")
OUTPUT_PATH = os.path.expanduser("~/reddit-karma-landing/data/posts_by_community.json")
POSTS_PER_SUB = 50  # 每个社区获取帖子数
DELAY_BETWEEN_REQUESTS = 1.5  # 请求间隔(秒)
MAX_RETRIES = 3

def extract_communities():
    """从 data.js 提取社区名称列表"""
    with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 匹配 name: "xxx" 或 name: 'xxx'
    names = re.findall(r'name:\s*["\'](\w+)["\']', content)
    return list(dict.fromkeys(names))  # 去重保持顺序

def fetch_posts(subreddit, retries=MAX_RETRIES):
    """从 PullPush 获取社区帖子"""
    url = (
        f"https://api.pullpush.io/reddit/search/submission/"
        f"?subreddit={subreddit}&sort=created_utc&order=desc&size={POSTS_PER_SUB}"
    )
    
    headers = {"User-Agent": "KarmoraResearch/1.0"}
    req = urllib.request.Request(url, headers=headers)
    
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data.get("data", [])
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, Exception) as e:
            if attempt < retries - 1:
                print(f"  ⚠️  重试 {attempt+1}/{retries}: {e}")
                time.sleep(2)
            else:
                print(f"  ❌ 失败: {e}")
                return []

def process_posts(posts):
    """
    处理帖子列表:
    1. 按时间(天)分组
    2. 每组内按 score + num_comments 综合排序
    3. 返回排序后的帖子列表
    """
    if not posts:
        return []
    
    # 按天分组
    from collections import defaultdict
    by_day = defaultdict(list)
    
    for post in posts:
        ts = post.get("created_utc", 0)
        day = datetime.fromtimestamp(ts).strftime("%Y-%m-%d") if ts else "unknown"
        by_day[day].append(post)
    
    # 每天内按 score + num_comments 降序
    result = []
    for day in sorted(by_day.keys(), reverse=True):  # 时间降序
        day_posts = by_day[day]
        day_posts.sort(
            key=lambda p: (p.get("score", 0) + p.get("num_comments", 0)),
            reverse=True
        )
        result.extend(day_posts)
    
    return result

def extract_post_info(post):
    """提取帖子关键信息"""
    return {
        "id": post.get("id", ""),
        "title": post.get("title", ""),
        "selftext": (post.get("selftext", "") or "")[:500],  # 截断长文本
        "score": post.get("score", 0),
        "num_comments": post.get("num_comments", 0),
        "created_utc": post.get("created_utc", 0),
        "created_date": datetime.fromtimestamp(post.get("created_utc", 0)).strftime("%Y-%m-%d %H:%M") if post.get("created_utc") else "",
        "author": post.get("author", ""),
        "url": post.get("url", ""),
        "permalink": f"https://reddit.com{post.get('permalink', '')}",
        "link_flair_text": post.get("link_flair_text", ""),
        "is_self": post.get("is_self", False),
    }

def main():
    print("=" * 50)
    print("🚀 Karmora 帖子采集脚本")
    print("=" * 50)
    
    # 1. 读取社区列表
    communities = extract_communities()
    print(f"\n📋 共 {len(communities)} 个社区待采集\n")
    
    # 2. 确保输出目录存在
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    # 3. 逐个采集
    all_data = {}
    success_count = 0
    fail_count = 0
    
    for i, sub in enumerate(communities, 1):
        print(f"[{i}/{len(communities)}] r/{sub} ... ", end="", flush=True)
        
        posts = fetch_posts(sub)
        
        if posts:
            # 提取关键信息
            clean_posts = [extract_post_info(p) for p in posts]
            # 排序: 时间降序 → 同时间按 score+comments 降序
            sorted_posts = process_posts(clean_posts)
            
            all_data[sub] = {
                "count": len(sorted_posts),
                "posts": sorted_posts
            }
            print(f"✅ {len(sorted_posts)} 条")
            success_count += 1
        else:
            all_data[sub] = {"count": 0, "posts": [], "error": "fetch_failed"}
            print("❌ 无数据")
            fail_count += 1
        
        # 延迟
        if i < len(communities):
            time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # 4. 保存结果
    output = {
        "meta": {
            "total_communities": len(communities),
            "success": success_count,
            "failed": fail_count,
            "posts_per_sub": POSTS_PER_SUB,
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
