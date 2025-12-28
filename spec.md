# 單字閃卡複習公式（Spaced Repetition – Minimal Version）

## 一、單字狀態模型（核心）

每個單字只有三個狀態：

- `NEW`：新字
- `LEARNING`：學習中
- `MASTERED`：熟記

### 每個單字需儲存的最小欄位

- `state`
- `interval_days`
- `next_review_date`
- `success_streak`

---

## 二、複習間隔公式（固定且可預測）

### 初始間隔表

| Step   | 間隔         |
| ------ | ------------ |
| Step 0 | 0 天（當天） |
| Step 1 | 1 天         |
| Step 2 | 3 天         |
| Step 3 | 7 天         |
| Step 4 | 14 天        |
| Step 5 | 30 天        |

原則：在即將遺忘前複習，而不是等完全忘記。

---

## 三、評分輸入（只保留一個判斷）

每次複習只問一件事：

- 是否「主動回憶正確」？

結果只有兩種：

- `PASS`
- `FAIL`

不提供「有點會」「差不多」這類模糊選項。

---

## 四、狀態轉移規則（重點）

### PASS 規則

success_streak += 1
interval_days = 下一個 step 的天數
next_review_date = today + interval_days

if success_streak >= 3 and interval_days >= 14:
state = MASTERED

shell
複製程式碼

### FAIL 規則（嚴格）

state = LEARNING
success_streak = 0
interval_days = 1
next_review_date = tomorrow

yaml
複製程式碼

---

## 五、什麼時候算「熟記」

必須同時滿足以下條件：

- 成功回憶 ≥ 3 次
- 成功發生在 ≥ 14 天以上的間隔
- 任一次 `FAIL` → 立即降級為 `LEARNING`

目的：防止短期記憶造成的假熟。

---

## 六、最小可用偽程式碼

```pseudo
if result == PASS:
    success_streak += 1
    interval_days = next_interval(interval_days)
else:
    success_streak = 0
    interval_days = 1
    state = LEARNING

next_review_date = today + interval_days

if success_streak >= 3 and interval_days >= 14:
    state = MASTERED
```
