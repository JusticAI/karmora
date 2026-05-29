# 测试帖子 #1 — r/food

## 测试目标
检测标题格式违规（r/food 要求标题必须带 [tag]）

---

## 帖子内容

**标题：**
```
My grandma's secret recipe for the perfect lasagna
```

**正文：**
```
Hey everyone! So my grandma has been making this lasagna for over 40 years and she finally agreed to share the recipe with me. 

The key is to use fresh pasta sheets, not the dried ones. She makes a bolognese with ground beef and Italian sausage, adds a tiny bit of cinnamon (trust me on this), and uses a mix of ricotta and béchamel.

Layer it like this: sauce, pasta, meat, cheese, pasta, sauce, cheese on top. Bake at 375°F for about 45 minutes covered, then 15 minutes uncovered to get that golden crust.

Let me know if you want the full step-by-step!
```

---

## 预期检测结果

- 🔴 **高风险 — 标题格式违规**
- 违反 r/food Rule 3: Title Tags
- 标题必须包含以下标签之一：
  - `[homemade]` — 自己做的
  - `[I ate]` — 买来吃的
  - `[Pro/chef]` — 专业厨师做的
  - `[Text]` — 纯文字讨论
  - `[Produce]` — 原材料展示
- **后果：** AutoMod 自动删帖
- **修复建议：** 在标题前加 `[Homemade]`
