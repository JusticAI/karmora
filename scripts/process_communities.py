#!/usr/bin/env python3
"""
处理 Reddit 社区采集数据，生成 Karmora 网站用的 data.js
输入: ~/Downloads/reddit_community_all_2026-05-09.json
输出: ~/reddit-karma-landing/js/data.js
"""

import json
from collections import Counter

INPUT = '/Users/clawuser/Downloads/reddit_community_all_2026-05-09.json'
OUTPUT = '/Users/clawuser/reddit-karma-landing/js/data.js'

print(f"📂 读取 {INPUT} ...")
with open(INPUT, 'r') as f:
    data = json.load(f)

meta = data.get('meta', {})
communities = [c for c in data.get('communities', []) if c is not None]
print(f"✅ 共 {len(communities)} 个社区")

# === 30 类分类体系 ===
CAT_RULES = [
    ('ecommerce', ['ecommerce', 'dropship', 'shopify', 'amazon fba', 'etsy', 'seller', 'merch', 'print on demand', 'fulfillment', 'alibaba', 'wholesale']),
    ('tech', ['programming', 'coding', 'developer', 'javascript', 'python', 'react', 'webdev', 'software', 'github', 'devops', 'linux', 'windows', 'mac', 'android', 'ios', 'tech', 'artificial intelligence', 'machine learning', 'data science', 'startup', 'saas', 'code', 'api', 'cloud', 'aws', 'docker', 'cybersecurity', 'hacking', 'privacy', 'selfhosted', 'homelab']),
    ('gaming', ['game', 'gaming', 'minecraft', 'fortnite', 'valorant', 'league of legends', 'dota', 'overwatch', 'apex', 'call of duty', 'battlefield', 'destiny', 'steam', 'playstation', 'xbox', 'nintendo', 'pcgaming', 'esports', 'twitch', 'streamer', 'roblox', 'terraria', 'stardew', 'animal crossing', 'sims', 'halo', 'elden ring', 'dark souls', 'monster hunter', 'warframe', 'path of exile', 'diablo', 'world of warcraft', 'final fantasy', 'gta', 'red dead', 'skyrim', 'fallout']),
    ('crypto_finance', ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'stock', 'trading', 'invest', 'finance', 'forex', 'wallstreet', 'options', 'dividend', 'daytrading', 'personal finance', 'budget', 'saving', 'credit card', 'tax', 'insurance', 'retirement']),
    ('lifestyle', ['fitness', 'cooking', 'food', 'recipe', 'travel', 'camping', 'hiking', 'fashion', 'style', 'beauty', 'skincare', 'makeup', 'health', 'wellness', 'yoga', 'meditation', 'gardening', 'home', 'interior', 'diy', 'craft', 'plant', 'houseplant', 'baking', 'coffee', 'tea', 'wine', 'beer', 'cocktail', 'grilling', 'smoking', 'bbq', 'sourdough', 'bread', 'steak', 'pizza', 'nutrition', 'diet', 'keto', 'vegan', 'running', 'swimming', 'climbing', 'skiing', 'snowboarding', 'surfing', 'fishing', 'hunting', 'minimalism', 'frugal', 'cleaning', 'sous vide']),
    ('social', ['relationship', 'dating', 'confession', 'offmychest', 'vent', 'support', 'parenting', 'family', 'wedding', 'friendship', 'lonely', 'depression', 'anxiety', 'mental health', 'adhd', 'autism', 'bipolar', 'grief', 'divorce', 'breakup', 'tinder', 'bumble', 'introvert', 'love']),
    ('entertainment', ['movie', 'film', 'tv show', 'netflix', 'anime', 'manga', 'comic', 'book', 'podcast', 'youtube', 'tiktok', 'funny', 'humor', 'comedy', 'television', 'reality tv', 'stand up', 'improv', 'shameless']),
    ('science', ['science', 'physics', 'chemistry', 'biology', 'math', 'space', 'nasa', 'astronomy', 'geology', 'psychology', 'philosophy', 'history', 'education', 'academic', 'research', 'neuroscience', 'genetics', 'evolution', 'climate', 'environment', 'ecology', 'enlightenment']),
    ('news_politics', ['news', 'politic', 'world news', 'government', 'election', 'democrat', 'republican', 'conservative', 'liberal', 'geopolitic', 'law', 'legal', 'court', 'justice', 'censorship', 'russi', 'ukraine', 'war', 'conflict', 'trump', 'biden']),
    ('creative', ['art', 'design', 'photo', 'draw', 'paint', 'write', 'poem', 'creative', 'video', 'animation', '3d', 'blender', 'illustration', 'graphic design', 'pixel art', 'tattoo', 'embroidery', 'knitting', 'crochet', 'sewing', 'woodworking', 'pottery', 'music production', 'songwriting', 'singing', 'guitar', 'piano', 'drum', 'gemstones', 'mineral']),
    ('career', ['career', 'job', 'resume', 'interview', 'work', 'salary', 'freelance', 'remote', 'hire', 'recruit', 'unemployment', 'antiwork', 'work reform', 'retail', 'nurse', 'teacher', 'engineer', 'accounting', 'lawyer', 'doctor', 'adulting']),
    ('marketing', ['marketing', 'seo', 'social media', 'content creator', 'brand', 'advertising', 'growth', 'affiliate', 'influencer', 'copywriting', 'pinoyvlogger', 'vlog']),
    ('sports', ['nba', 'nfl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'cricket', 'mma', 'ufc', 'boxing', 'formula', 'f1', 'racing', 'premier league', 'world cup', 'olympics', 'wrestling', 'wwe', 'rugby', 'nascar', 'manchester united']),
    ('auto', ['car', 'cars', 'auto', 'bmw', 'tesla', 'honda', 'toyota', 'ford', 'mustang', 'jeep', 'truck', 'motorcycle', 'mechanic', 'detailing', 'engine', 'drift', 'electric vehicle', 'bumperstickers', 'gulong']),
    ('pets_animals', ['cat', 'cats', 'dog', 'dogs', 'puppy', 'kitten', 'pet', 'bird', 'fish', 'aquarium', 'reptile', 'hamster', 'rabbit', 'horse', 'wildlife', 'animal', 'parrot', 'corgi', 'golden retriever', 'husky', 'pitbull', 'shiba', 'snake', 'lizard', 'turtle', 'spider', 'weevil', 'stupiddovenest', 'ifiitsisits']),
    ('region', ['europe', 'canada', 'australia', 'india', 'japan', 'korea', 'philippines', 'brazil', 'mexico', 'germany', 'france', 'ireland', 'singapore', 'malaysia', 'indonesia', 'vietnam', 'thailand', 'turkey', 'argentina', 'chile', 'colombia', 'romania', 'poland', 'hungary', 'sweden', 'norway', 'denmark', 'netherlands', 'belgium', 'switzerland', 'austria', 'new zealand', 'south africa', 'nigeria', 'israel', 'pakistan', 'taiwan', 'hong kong', 'london', 'nyc', 'new york', 'los angeles', 'chicago', 'seattle', 'portland', 'austin', 'miami', 'boston', 'toronto', 'vancouver', 'sydney', 'melbourne', 'tokyo', 'seoul', 'mumbai', 'delhi', 'bangalore', 'dubai', 'manchester', 'oregon', 'askph']),
    ('music_artist', ['taylor swift', 'kanye', 'drake', 'eminem', 'kendrick', 'beyonce', 'lady gaga', 'frank ocean', 'kpop', 'bts', 'blackpink', 'ariana', 'billie eilish', 'radiohead', 'beatles', 'nirvana', 'metallica', 'linkin park', 'gorillaz', 'arctic monkeys', 'tame impala', 'weeknd', 'travis scott', 'playboi carti', 'tyler the creator', 'charli xcx', 'kasane teto']),
    ('media_fandom', ['naruto', 'dragon ball', 'one piece', 'bleach', 'hunter x hunter', 'my hero academia', 'demon slayer', 'attack on titan', 'jujutsu kaisen', 'chainsaw man', 'spy family', 'death note', 'evangelion', 'ghibli', 'marvel', 'dc comics', 'star wars', 'star trek', 'harry potter', 'lord of the rings', 'game of thrones', 'witcher', 'stranger things', 'breaking bad', 'better call saul', 'simpsons', 'south park', 'family guy', 'futurama', 'office', 'friends', 'seinfeld', 'bojack horseman', 'pokemon', 'zelda', 'mario', 'sonic', 'hollow knight', 'undertale', 'fnaf', 'baldurs gate', 'elden ring', 'hazbin', 'hellaverse', 'murder drones', 'grapplerbaki', 'baki', 'meatcanyon', 'lobotomykaisen', 'okbuddy', 'spunchbob', 'sopranos', 'bachelor', 'barbie']),
    ('reddit_meta', ['announcements', 'blog', 'modsupport', 'modhelp', 'theoryofreddit', 'ideasfortheadmins', 'beta', 'redesign', 'bugs', 'feedback', 'subredditdrama', 'bestof', 'depthhub', 'karmacourt', 'freekarma', 'allthequestions']),
    ('self_improvement', ['productivity', 'getdisciplined', 'getmotivated', 'selfimprovement', 'decidingtobebetter', 'howtonotgiveafuck', 'stoicism', 'nofap', 'leaves', 'stopdrinking', 'stopsmoking', 'loseit', 'progresspics', 'intermittentfasting', 'bodyweightfitness', 'flexibility', 'posture', 'sleep', 'habit', 'journal', 'gratitude', 'hydrohomies', 'antinatalism']),
    ('vehicles_transport', ['aviation', 'pilot', 'airplane', 'train', 'rail', 'bicycle', 'bicycling', 'skateboard', 'longboard', 'scooter', 'boat', 'sail', 'rv', 'van', 'vanlife', 'trucking', 'uber', 'lyft', 'doordash', 'woodstoving']),
    ('misc_interest', ['watches', 'sneakers', 'headphones', 'audiophile', 'mechanical keyboard', 'lego', 'vinyl', 'record', 'fragrance', 'perfume', 'cologne', 'pen', 'fountain pen', 'crossword', 'chess', 'poker', 'board game', 'dnd', 'warhammer', 'magic the gathering', 'yugioh', 'mcdonald', 'obsidian']),
    ('meme_shitpost', ['shitpost', 'circlejerk', 'greentext', 'copypasta', 'newgreentexts', '2sentence2horror', 'boykisser', 'picsthatgohard', 'countablepixels', 'sssdfg', 'absoluteunit', 'tragedeigh', 'whoathatsinteresting', 'overheard', 'confusing perspective', 'tvtoohigh', 'why women live longer', 'thematpat effect', 'first time ko', 'whybrows', 'the word fuck', 'bara walther']),
    ('non_english', ['preguntasreddit', 'rusaskreddit', 'eusouobabaca', 'wirklichgutefrage', 'askmec', 'tja', 'aberbitte', 'liseliler', 'azubis', 'ohnepixel', 'peliculas', 'twitter_brasil', 'big brother brasil', 'sunraybee', 'ichbin40und', 'botecodoreddit', 'futebol', 'gulong']),
    ('decade_nostalgia', ['70s', '80s', '90s', '2000s', 'decadeology', 'oldschoolcool', 'vintage', 'retro', 'nostalgia']),
    ('debate_judge', ['amiugly', 'amithedevil', 'amiwrong', 'roastme', 'would you rather']),
    ('brand_tech', ['anthropic', 'openai', 'claude', 'chatgpt', 'visionpro', 'ubiquiti', 'apple', 'google', 'samsung', 'sony']),
    ('other', []),  # catch-all
]

def classify(name, about, rules_data, wiki_data):
    n = (name or '').lower()
    title = (about or {}).get('title', '').lower()
    desc = ((about or {}).get('public_description', '') or '').lower()
    full_desc = ((about or {}).get('description', '') or '').lower()
    text = f"{n} {title} {desc} {full_desc}"

    category = 'other'
    for cat, keywords in CAT_RULES:
        if cat == 'other':
            continue
        if any(kw in text for kw in keywords):
            category = cat
            break

    if (about or {}).get('over18', False):
        category = 'nsfw'

    subs = (about or {}).get('subscribers', 0) or 0
    active = (about or {}).get('active_users', 0) or 0

    if subs >= 10000000: size = 'mega'
    elif subs >= 1000000: size = 'large'
    elif subs >= 100000: size = 'medium'
    elif subs >= 10000: size = 'small'
    else: size = 'micro'

    rules_list = []
    if rules_data and isinstance(rules_data, list):
        for r in rules_data[:5]:
            rule = {
                'name': r.get('short_name', r.get('name', '')),
                'desc': (r.get('description', '') or '')[:80],
                'severity': 'warning'
            }
            rd = (r.get('description', '') or '').lower()
            if any(w in rd for w in ['ban', 'permanently', 'immediate ban', 'removal']):
                rule['severity'] = 'ban'
            elif any(w in rd for w in ['warning', 'removed', 'delete']):
                rule['severity'] = 'warning'
            else:
                rule['severity'] = 'info'
            rules_list.append(rule)

    has_wiki = bool(wiki_data)
    has_rules = len(rules_list) > 0
    if has_rules and subs >= 100000: badge = 'excellent'
    elif has_rules and subs >= 10000: badge = 'good'
    elif subs >= 10000: badge = 'fair'
    else: badge = 'low'

    return {
        'name': name,
        'title': (about or {}).get('title', ''),
        'desc': ((about or {}).get('public_description', '') or '')[:150],
        'subscribers': subs,
        'active_users': active,
        'category': category,
        'size': size,
        'badge': badge,
        'over18': bool((about or {}).get('over18', False)),
        'subreddit_type': (about or {}).get('subreddit_type', 'public'),
        'rules_count': len(rules_list),
        'rules': rules_list,
        'has_wiki': has_wiki,
    }

# === 处理 ===
print("🔄 分类处理中...")
processed = []
for i, c in enumerate(communities):
    name = c.get('name', '')
    about = c.get('about', {})
    rules_data = c.get('rules', [])
    wiki_data = c.get('wiki', None)
    result = classify(name, about, rules_data, wiki_data)
    processed.append(result)
    if (i + 1) % 1000 == 0:
        print(f"   已处理 {i + 1}/{len(communities)}")

print(f"✅ 处理完成: {len(processed)} 个社区")

# === 统计 ===
cats = Counter(c['category'] for c in processed)
sizes = Counter(c['size'] for c in processed)
badges = Counter(c['badge'] for c in processed)
nsfw = sum(1 for c in processed if c['over18'])
has_rules = sum(1 for c in processed if c['rules_count'] > 0)

print(f"\n📊 统计:")
print(f"  NSFW: {nsfw}")
print(f"  有规则数据: {has_rules}")
print(f"\n  分类分布 ({len(cats)} 类):")
for cat, count in cats.most_common():
    print(f"    {cat}: {count}")
print(f"\n  规模分布:")
for size, count in sizes.most_common():
    print(f"    {size}: {count}")
print(f"\n  质量分布:")
for badge, count in badges.most_common():
    print(f"    {badge}: {count}")

# === 输出 ===
print(f"\n📝 写入 {OUTPUT} ...")
js_data = json.dumps(processed, ensure_ascii=False)
js_content = f"// Karmora 社区数据 - {len(processed)} communities\n// 采集时间: {meta.get('collected_at', 'unknown')}\nconst COMMUNITIES = {js_data};\n"

with open(OUTPUT, 'w') as f:
    f.write(js_content)

import os
size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
print(f"✅ 完成! {size_mb:.1f} MB | {len(processed)} 社区 | {len(cats)} 分类 | {has_rules} 有规则")
