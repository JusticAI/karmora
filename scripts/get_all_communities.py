#!/usr/bin/env python3
"""
获取所有 Reddit 社区（26字母搜索，分页获取全部）
"""

import json
import os
import time
import urllib.request

HEADERS = {"User-Agent": "KarmoraResearch/1.0"}
OUTPUT_PATH = os.path.expanduser("~/reddit-karma-landing/data/all_communities.json")

def search_communities(query):
    """搜索社区，分页获取全部"""
    all_communities = []
    after = None
    page = 0
    
    while True:
        page += 1
        url = f"https://www.reddit.com/subreddits/search.json?q={query}&limit=100"
        if after:
            url += f"&after={after}"
        
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            
            children = data.get('data', {}).get('children', [])
            after = data.get('data', {}).get('after')
            
            for child in children:
                d = child['data']
                all_communities.append({
                    'name': d.get('name', ''),
                    'title': d.get('title', ''),
                    'description': d.get('public_description', ''),
                    'subscribers': d.get('subscribers', 0),
                    'created_utc': d.get('created_utc', 0),
                    'lang': d.get('lang', 'en'),
                    'subreddit_type': d.get('subreddit_type', 'public'),
                    'over18': d.get('over18', False),
                })
            
            if page % 5 == 0:
                print(f"    Page {page}: {len(all_communities)} communities")
            
            if not after:
                break
            
            time.sleep(1.5)
            
        except Exception as e:
            print(f"    Error on page {page}: {e}")
            time.sleep(3)
            continue
    
    return all_communities

def main():
    print("=" * 50)
    print("Karmora: Get All Reddit Communities")
    print("=" * 50)
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    all_communities = []
    
    # 26个字母 + 数字
    search_terms = list('abcdefghijklmnopqrstuvwxyz') + ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    
    for i, term in enumerate(search_terms, 1):
        print(f"\n[{i}/{len(search_terms)}] Searching '{term}'...")
        communities = search_communities(term)
        print(f"  Found: {len(communities)}")
        all_communities.extend(communities)
        time.sleep(2)
    
    # 去重
    seen = set()
    unique_communities = []
    for c in all_communities:
        if c['name'] not in seen:
            seen.add(c['name'])
            unique_communities.append(c)
    
    # 按订阅者排序
    unique_communities.sort(key=lambda x: x['subscribers'], reverse=True)
    
    print(f"\n{'=' * 50}")
    print(f"Done!")
    print(f"  Total fetched: {len(all_communities)}")
    print(f"  Unique: {len(unique_communities)}")
    print(f"  Saved to: {OUTPUT_PATH}")
    print(f"{'=' * 50}")
    
    # 保存
    output = {
        'meta': {
            'total': len(unique_communities),
            'collected_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        },
        'communities': unique_communities
    }
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
