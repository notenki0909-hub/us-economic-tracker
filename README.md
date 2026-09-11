# 米国経済指標トラッカー

米国の主要経済指標（景気・物価・雇用・所得・対外・金利・為替・市場）の「いま」と推移を、
一覧で確認できる公開用 Web ツール。株価（S&P500等）への影響度を基準に指標を選定している。

日本版 [経済指標トラッカー](../keizai-shihyo-tracker) の姉妹サイト。UI・機能は共通、
データと指標構成のみ米国向け。

**公開URL**: https://notenki0909-hub.github.io/us-economic-tracker/

- **データ源**: [FRED（セントルイス連邦準備銀行）](https://fred.stlouisfed.org/) のみ
  （**利用登録・APIキー不要**）。BEA・BLS・FRB・Census Bureau・CBOE等の公的統計をFRED経由で
  一括取得できるため、日本版（4つのデータソースを使い分け）より構成がシンプル。
- **構成**: 静的サイト（Vite + Chart.js + chartjs-plugin-annotation）＋ GitHub Actions による
  平日毎日のデータチェック（22:00 UTC＝米東部時間の市場引け後）
- **蓄積レイヤーなし**: 毎回 API から全期間を取り直すため、速報値の改定にも自動追従。
- **判断の目安・重要度★・カテゴリ別「見る順番」ガイド・ライト/ダーク切替**：日本版と同じ機能一式
- **次回発表予定日**：FREDの各系列ページが持つ「Next Release Date」メタデータから取得し、
  詳細モーダルに表示（BLS・BEA・FRB等の公式発表予定日）。**市場予想（コンセンサス）は無償の
  公式データ源が構造的に存在しないため掲載していない**（詳細は下記）。

## 追跡している21指標

| カテゴリ | 指標 | ★ | 周期 | FRED系列ID |
|---|---|---|---|---|
| 景気 | 実質GDP成長率（前期比年率） | ★★★★☆ | 四半期 | `A191RL1Q225SBEA` |
| 景気 | ミシガン大学消費者信頼感指数 | ★★☆☆☆ | 月次 | `UMCSENT` |
| 景気 | 鉱工業生産指数 | ★★★☆☆ | 月次 | `INDPRO` |
| 景気 | 耐久財受注（3か月移動平均つき） | ★★★☆☆ | 月次 | `DGORDER` |
| 景気 | 小売売上高（前月比） | ★★★★★ | 月次 | `RSAFS`（MoM%自前算出） |
| 物価 | 消費者物価指数（CPI・前年同月比） | ★★★★★ | 月次 | `CPIAUCSL`（YoY自前算出） |
| 物価 | コアPCE物価指数（前年同月比） | ★★★★★ | 月次 | `PCEPILFE`（YoY自前算出） |
| 雇用・所得 | 失業率 | ★★★☆☆ | 月次 | `UNRATE` |
| 雇用・所得 | 非農業部門雇用者数（前月差） | ★★★★★ | 月次 | `PAYEMS`（前月差自前算出） |
| 雇用・所得 | 実質週給（フルタイム労働者・前年同期比） | ★★★☆☆ | 四半期 | `LES1252881600Q`（YoY自前算出） |
| 雇用・所得 | 新規失業保険申請件数 | ★★★☆☆ | **週次** | `ICSA` |
| 雇用・所得 | JOLTS求人件数 | ★★★★☆ | 月次 | `JTSJOL` |
| 対外 | 経常収支 | ★★☆☆☆ | 四半期 | `IEABC` |
| 対外 | 貿易収支 | ★★☆☆☆ | 月次 | `BOPGSTB` |
| 金利 | FF金利（政策金利） | ★★★★★ | 月次 | `FEDFUNDS` |
| 金利 | 長短金利差（10年-2年国債利回り） | ★★★★★ | **日次**（2016年〜） | `T10Y2Y` |
| 金利 | 米10年国債利回り | ★★★★★ | **日次**（2016年〜） | `DGS10` |
| 金利 | FRBバランスシート（総資産） | ★★★☆☆ | **週次**（2016年〜） | `WALCL` |
| 為替・市場 | 貿易加重ドル指数 | ★★★★☆ | **日次**（2016年〜） | `DTWEXBGS` |
| 為替・市場 | S&P500種株価指数 | ★★★★★ | **日次**（2016年〜） | `SP500` |
| 為替・市場 | VIX指数（恐怖指数） | ★★★★★ | **日次**（2016年〜） | `VIXCLS` |

指標の追加・変更は [`scripts/indicators.config.mjs`](scripts/indicators.config.mjs) を編集する。
新しいFRED系列は https://fred.stlouisfed.org/ で検索し、系列ページのIDをそのまま使える。

### データ取得の仕組み

[`scripts/fetch-fred-series.mjs`](scripts/fetch-fred-series.mjs) が
`https://fred.stlouisfed.org/graph/fredgraph.csv?id=<SERIES_ID>` からCSVを直接取得する
（登録・キー不要）。FRED側の `units=` パラメータはこの軽量エンドポイントでは機能しないため、
前年同月比（`yoy`）・前月差（`mom_diff`）は取得後にこちら側で計算している
（`api.transform` で指標ごとに指定）。

- 欠測値はCSV上で空文字列（`.` ではない）。`Number("")` はJSでは`0`になるため明示的に除外している
  （日本版のFRED系列でも一度この不具合が起きており、同じ対処を最初から組み込んでいる）
- 日次・週次系列（10年国債利回り・長短金利差・FRBバランスシート・ドル指数・S&P500・VIX・
  新規失業保険申請）はデータ量・表示性能の都合で2016年以降のみ収録（`api.since` で指標ごとに
  指定可能）。それ以外の月次・四半期系列は1990年以降を収録。
- `mom_pct`（前月比%、小売売上高で使用）も `transform` の一種として実装済み。

### 検討したが見送った指標

- **ISM製造業景況指数（PMI）**：2016年6月24日、ISM自身の要請によりFREDから全22系列が削除された
  （[St. Louis Fed公式発表](https://news.research.stlouisfed.org/2016/06/institute-for-supply-management-data-to-be-removed-from-fred/)）。
  以降、無償・登録不要での取得手段はない。
- **investing.com等の代替ソース**：技術的にも（強力なボット対策で本体・API候補とも403）、
  規約的にも（利用規約で自動データ取得を明示的に禁止）採用不可と判断。書面での許可を得れば
  使える可能性はあるが、それは自動化スクリプトの範囲外の人的な交渉が必要。

### 次回発表予定日・市場予想（コンセンサス）について

[`scripts/fetch-fred-release-date.mjs`](scripts/fetch-fred-release-date.mjs) が、各FRED系列ページ
（`https://fred.stlouisfed.org/series/<SERIES_ID>`）に掲載されている **`Next Release Date`**
というメタデータを取得している。これはBLS・BEA・FRB・Census Bureau等が公表する公式の発表予定日を
FRED自身が保持しているものなので、新たなデータソース・規約リスクを増やさずに実装できた
（21指標すべてで取得成功を確認済み）。取得に失敗した場合は `nextRelease: null` となり、
フロントエンドが「未定」と表示する。

一方、**市場予想（コンセンサス）はこのツールでは取得・掲載していない**。これは政府統計機関では
なく民間データベンダー（Bloomberg・Reuters等）がエコノミストへの調査を集計する商用データであり、
無償・登録不要で配信するソースが構造的に存在しない：

- investing.com：技術的（403ブロック）・規約的（自動取得を明示的に禁止）に不可（既述）
- Trading Economics：無償のguestアカウントアクセスは廃止済み（HTTP 410、現在は有料プランのみ）
- FXStreet・OHLC.dev等：検索で見つかる同種サービスもすべて有料API

そのため詳細モーダルにも市場予想の項目自体を表示していない（「なし」等のプレースホルダーも出さない）。
将来、無償ソースが見つかった場合や、有償APIキーの利用を許容する方針転換があった場合に改めて追加する。

## ローカル開発

```bash
npm install
npm run fetch     # public/data/indicators.json を最新化
npm run dev       # http://localhost:5174
npm run build     # dist/ に静的ファイルを出力
npm run preview   # ビルド結果を確認
```

## 公開（GitHub Pages）

日本版と同じ手順：

1. このディレクトリを GitHub リポジトリとして push する。
2. **Settings → Pages → Source** を **GitHub Actions** にする。
3. **Settings → Actions → General → Workflow permissions** を **Read and write** にする
   （自動データ更新のコミットに必要）。
4. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) が
   - `push`（main）… ビルドして公開
   - 平日毎日 22:00 UTC（米東部17〜18時ごろ）／手動実行 … FREDからデータを取り直し、
     変化があればコミット → 公開
   を自動で行う。

## 出典・免責

FRED（セントルイス連邦準備銀行）経由で、BEA（経済分析局）・BLS（労働統計局）・
FRB（連邦準備制度理事会）・Census Bureau・CBOE等の公的統計を取得・加工。
公的統計を分かりやすく表示することを目的とした非公式ツール。
