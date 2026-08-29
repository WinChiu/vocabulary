<design-context>
---
version: quiet-focus-2
name: Quiet Focus design system (restructured IA)
stylesheet: "src/css/app.css"
icons: "Phosphor (bold weight)"
---

「Quiet Focus」是 Just Word 的視覺與資訊架構依據：近乎單色的米紙／墨黑，一個赭橙色
（burnt sienna）點綴色；Fraunces 系的 Newsreader 襯線用於單字本身與大數字，Manrope
系的 Archivo 幾何無襯線用於介面文字。樣式自成一體，定義在 `src/css/app.css`。

## 資訊架構（v2 重點——不要退回舊的 9 頁 + 4 分頁結構）

App 只有三個核心場景，不要再拆回獨立整頁：

- **Today（`#dashboard`）**：合併了舊的 Dashboard + Review-setup。今日待複習數字＋
  CTA 直接開始複習；進階篩選收在「Customize this session」inline 手風琴
  （`#customize-session-accordion`），不要拆成獨立頁面。
- **Library（`#words`）**：合併了舊的 Words + Add-card 入口 + Import 入口 + Filter。
  搜尋/篩選用 `.filter-sheet` 底部抽屜；新增用右下角 `.add-fab` 呼出
  `#words-add-sheet` 兩選一（Add one word / Import a CSV），再各自導向
  `#add-card` / `#import`（這兩個頁面本身視覺上仍呈現為「sheet」——`.sheet-view`，
  帶頂部把手 `.sheet-view-handle`）。點一個字用 `#card-preview`（`.panel-view`），
  上一個/下一個用標題列的箭頭圖示，不要恢復成獨立的整頁 + 底部 footer 導覽列。
- **Session（`#review-session`）**：全螢幕沉浸式複習，刻意反轉成深色主題（進入「專注
  模式」的訊號，token 覆寫在 `#review-session { --bg: ...; --ink: ...; }`）。複習結束
  不要跳新頁——直接在同一個容器切換成總結狀態（`#review-summary-content`），舊的
  `#review-summary` 獨立 view 已移除。

導覽只剩 Today / Library 兩個分頁，做成頂部置中的小型 segmented pill
（`#bottom-nav-container.top-navigation`，id 沿用舊名但已改為頂部小 pill，不是底部
四宮格），Review 與 Import 不是分頁目的地。

## 硬規則

- 只連結一份樣式表 `src/css/app.css`；顏色、字體、圓角一律取自 `:root` 的 CSS 變數
  （`--bg`、`--ink`、`--accent`、`--border`…）。深色的 Session 場景用同名變數在
  `#review-session` 選擇器內覆寫，而不是另外開一套 class。**任何只設定 `color`／
  `background` 給子元素但沒有在該作用域根節點顯式宣告一次的 dark override 都不會生效
  ——繼承屬性要在覆寫 custom property 的同一個選擇器上重新宣告一次。**
- 兩種字體：`--font-serif`（Newsreader，單字、大數字、標題）與 `--font-ui`
  （Archivo，介面文字、按鈕、標籤）。
- 元件一律列表化、無卡片陰影堆疊：`.vocab-list-item` 用左側 2px 色條
  （`:has(.level-*)` 選取器）表示狀態，不要恢復成右側徽章 pill。
- 互動用真正的 sheet/panel 語彙：`.scrim` + `.sheet`、`.filter-sheet`、
  `.sheet-view`、`.panel-view`，不要把新增/篩選/字詞詳情做成一般整頁 push。
- `position: fixed` 的元素（`.top-navigation`、`.filter-pill`、`.add-fab`、
  `.form-actions-fixed`、`.filter-sheet`）**不要**加 `.main-workspace X { position:
  absolute }` 覆寫——那會讓它們相對於可捲動的 `.main-workspace` 定位而不是視窗，在長
  列表頁會被推到頁面最底部而不是螢幕底部。維持 `position: fixed`，需要置中時用
  `margin/max-width` 或 `left:50%; transform:translateX(-50%)`。
- 互動狀態一律主題化：focus 用
  `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`。

## 保持不變

`spec.md` 的間隔重複邏輯（NEW / LEARNING / MASTERED、0-1-3-7-14-30 天、PASS/FAIL 二元
評分）與所有畫面既有的 ID、狀態 class（`active`、`hidden`、`is-open`、`filters-open`、
`starred`、`error`、`correct`、`shake`、`green`、`orange`、`revealed`、
`is-review-list`、`is-review-complete`、`session-finished`、`modal-open`）不受設計系統
影響，JS 行為與資料模型完全保留。`js/app.js`、`js/review.js` 內部模組 import 一律共用
同一組版本查詢字串（目前 `?v=6.0`）——改了對應的 `.js` 檔內容記得一起升版，否則瀏覽器
可能繼續吃到快取的舊版本。

</design-context>
