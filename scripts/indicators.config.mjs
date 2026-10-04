/**
 * 追跡する米国経済指標の定義。データ源はすべて FRED（セントルイス連邦準備銀行）。
 * https://fred.stlouisfed.org/ 　利用登録不要・APIキー不要。
 *
 * api.transform: "level"（そのまま）/ "yoy"（前年同月・同期比%を自前計算）/
 *                "mom_diff"（前月差、水準の変化量）
 *
 * betterWhen / judgment / referenceLines / releaseSchedule / importance は
 * 日本版（keizai-shihyo-tracker）と同じ設計思想。詳細は各ファイルのコメント参照。
 */
export const INDICATORS = [
  {
    id: "gdp_growth_us",
    importance: 4,
    name: "実質GDP成長率",
    shortName: "実質GDP",
    category: "景気",
    unit: "%",
    unitLabel: "前期比年率 %",
    frequency: "quarterly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "米国商務省経済分析局（BEA）が四半期ごとに公表する実質GDPの、季節調整済み前期比年率。" +
      "米国経済全体の拡大・縮小を示す最も包括的な指標で、世界最大の経済圏の体温計として" +
      "世界の株式市場に影響を与える。速報値の後、複数回改定される。",
    judgment: {
      summary: "0%を上回れば拡大、下回れば縮小。ただし1四半期のマイナスだけで『不況』と決めつけず、複数四半期の傾向で見る。",
      goodWhen: "プラス成長が複数四半期続いている状態。年率2%前後は米国の潜在成長率に近い健全な水準とされる。",
      badWhen: "2四半期連続のマイナス成長（テクニカル・リセッションの目安の一つ）。",
      caveat: "在庫investment・純輸出など振れの大きい項目の影響を受けやすい。個人消費・設備投資など内訳も合わせて見ると実態が分かりやすい。",
    },
    referenceLines: [{ value: 0, label: "0%＝拡大・縮小の分岐", kind: "neutral" }],
    releaseSchedule: "BEAが四半期終了の約1か月後に速報を公表、その後2回改定（合計3回発表）。",
    api: { provider: "fred", seriesId: "A191RL1Q225SBEA", transform: "level", statName: "Real GDP, % Change from Preceding Period (BEA)" },
  },
  {
    id: "consumer_sentiment_us",
    importance: 2,
    name: "ミシガン大学消費者信頼感指数",
    shortName: "消費者信頼感",
    category: "景気",
    unit: "",
    unitLabel: "指数（1966年第1四半期=100）",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "ミシガン大学が消費者への調査をもとに算出する、家計の景況感・購買意欲を示す指数。" +
      "月2回（速報値・確報値）公表され、個人消費が経済の7割を占める米国では注目度が高い。",
    judgment: {
      summary: "絶対水準よりも前月・前年からの変化の方向を見る。過去のレンジ（好況期100超、不況期50台）と比較すると位置づけが分かりやすい。",
      goodWhen: "数か月連続で上昇している状態（消費者マインドの改善）。",
      badWhen: "急激な低下（インフレ懸念や雇用不安の高まりを反映しやすい）。",
      caveat: "調査ベースの指標のため、実際の消費支出（小売売上高等）とは一時的に乖離することがある。",
    },
    referenceLines: [{ value: 100, label: "基準期間(1966年)=100", kind: "context" }],
    releaseSchedule: "ミシガン大学が毎月2回（月中に速報、月末に確報）公表。",
    api: { provider: "fred", seriesId: "UMCSENT", transform: "level", statName: "University of Michigan: Consumer Sentiment" },
  },
  {
    id: "industrial_production_us",
    importance: 3,
    name: "鉱工業生産指数",
    shortName: "鉱工業生産",
    category: "景気",
    unit: "",
    unitLabel: "指数（2017年=100）",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "FRB（連邦準備制度理事会）が公表する、製造業・鉱業・公益事業の生産活動の水準を示す指数。" +
      "GDPより早く・毎月発表されるため、実体経済の動きを速報的に把握する代表的な指標。",
    judgment: {
      summary: "前月比・前年比のプラスマイナスで生産活動の拡大・縮小を判断する。",
      goodWhen: "前月比プラスが複数か月続いている状態。",
      badWhen: "前月比マイナスが継続、特に製造業の稼働率低下を伴う場合は景気減速のサイン。",
      caveat: "自動車・エネルギー部門など特定業種の一時的要因（ストライキ、悪天候等）で大きく振れることがある。",
    },
    referenceLines: [{ value: 100, label: "基準年(2017年)=100", kind: "context" }],
    releaseSchedule: "FRBが対象月の翌月中旬ごろに公表。",
    api: { provider: "fred", seriesId: "INDPRO", transform: "level", statName: "Industrial Production Index (Federal Reserve)" },
  },
  {
    id: "durable_goods_orders_us",
    importance: 3,
    name: "耐久財受注",
    shortName: "耐久財受注",
    category: "景気",
    unit: "百万ドル",
    unitLabel: "百万ドル",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "米国勢調査局（Census Bureau）が公表する、耐久財（自動車・航空機・機械等、3年以上使用される" +
      "製品）の新規受注額。企業の設備投資意欲を映す先行指標で、日本の機械受注に相当する。",
    judgment: {
      summary: "単月の増減は航空機受注など大口案件で大きく振れるため、移動平均や『輸送用機器を除く』ベースで基調を見るのが一般的。",
      goodWhen: "3か月移動平均が上向き、または複数か月連続で前月比プラス（設備投資意欲の高まり）。",
      badWhen: "3か月移動平均が下向き（企業の投資意欲減退＝景気減速のサイン）。",
      caveat: "航空機受注（ボーイング社等の大型契約）1件で月次の振れが数十%に達することがある。単月の増減だけで判断しない。",
    },
    referenceLines: [],
    movingAverage: { window: 3, label: "3か月移動平均" },
    releaseSchedule: "Census Bureauが対象月の翌月下旬ごろに公表。",
    // DGORDERはFRED上で「M3 Full Report」（確定値、翌月2日頃）のリリースファミリーに
    // 紐づいており、FREDのNext Release Dateメタデータをそのまま使うと、実際に新しい
    // 月次値が最初に公表される「Advance Report on Durable Goods」（速報値、当月下旬）の
    // 日付と一致しない。そのためCensus公式カレンダーから直接取得する。
    nextReleaseSource: { type: "census", match: "Advance Report on Durable Goods" },
    api: { provider: "fred", seriesId: "DGORDER", transform: "level", statName: "Manufacturers' New Orders: Durable Goods (Census Bureau)" },
  },
  {
    id: "retail_sales_us",
    importance: 5,
    name: "小売売上高",
    shortName: "小売売上高",
    category: "景気",
    unit: "%",
    unitLabel: "前月比 %",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "Census Bureauが毎月公表する、小売業者の売上高（自動車・外食含む）の前月比。個人消費が" +
      "GDPの約7割を占める米国経済において、消費の『いま』を最も速報的に示す指標。雇用統計と並んで" +
      "月次指標の中で特に市場インパクトが大きい。",
    judgment: {
      summary: "個人消費の強さをそのまま反映する。強すぎず弱すぎない、緩やかな増加が続く状態が最も安定的とされる。",
      goodWhen: "前月比0.3〜0.5%程度の安定的な増加が続いている状態。",
      badWhen: "マイナスが継続、または急減速している状態（消費者マインドの悪化・景気減速のサイン）。",
      caveat: "名目値（物価変動を調整していない）のため、ガソリン価格の変動等で実態以上に振れることがある。自動車・ガソリンを除いた『コア小売売上高』と合わせて見ると基調がより正確に分かる。",
    },
    referenceLines: [{ value: 0, label: "0%＝増加・減少の分岐", kind: "neutral" }],
    releaseSchedule: "Census Bureauが対象月の翌月中旬ごろ8:30 ETに公表。",
    api: { provider: "fred", seriesId: "RSAFS", transform: "mom_pct", statName: "Advance Retail Sales: Retail Trade and Food Services (Census Bureau)" },
  },
  {
    id: "cpi_yoy_us",
    importance: 5,
    name: "消費者物価指数（CPI）",
    shortName: "CPI",
    category: "物価",
    unit: "%",
    unitLabel: "前年同月比 %",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "米国労働統計局（BLS）が公表する消費者物価指数の前年同月比。米国で最も報道される物価指標で、" +
      "FRB（連邦準備制度理事会）の金融政策・市場の利上げ/利下げ観測を大きく左右する。",
    judgment: {
      summary:
        "FRBは『物価安定の目標』として2%（PCEベース）を掲げている。0%近辺はデフレ懸念、行き過ぎたプラスは" +
        "利上げ観測・株式市場の下落要因になりやすいため、高ければ良い・低ければ良いと単純には言えない。",
      goodWhen: "2%前後で安定的に推移している状態。",
      badWhen: "0%以下（デフレ懸念）、または4%を超えるような高インフレ（利上げ観測・生活費圧迫）。",
      caveat: "食品・エネルギー価格の変動が大きく影響する。『コア指数』（食品・エネルギー除く）と合わせて見ると基調がより分かりやすい。",
    },
    referenceLines: [
      { value: 2, label: "FRBの物価目標 2%の目安", kind: "target" },
      { value: 0, label: "0%＝デフレとの分岐", kind: "neutral" },
    ],
    releaseSchedule: "BLSが対象月の翌月中旬ごろ8:30 ET（日本時間 夜〜深夜）に公表。",
    api: { provider: "fred", seriesId: "CPIAUCSL", transform: "yoy", statName: "Consumer Price Index for All Urban Consumers (BLS)" },
  },
  {
    id: "core_pce_yoy_us",
    importance: 5,
    name: "コアPCE物価指数",
    shortName: "コアPCE",
    category: "物価",
    unit: "%",
    unitLabel: "前年同月比 %",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "米国商務省経済分析局（BEA）が公表する個人消費支出（PCE）物価指数のうち、食品・エネルギーを" +
      "除いたコアベースの前年同月比。FRBが金融政策運営で実際に参照する『本命』の物価指標で、" +
      "CPIより算出方法が精緻とされる。",
    judgment: {
      summary: "CPIと同様、FRBの目標2%を基準に判断する。CPIより振れが小さく、FRBの利上げ・利下げ判断に直結する分、市場のインパクトも大きい。",
      goodWhen: "2%前後で安定的に推移している状態。",
      badWhen: "2%を大きく上回る状態が続く（利上げ長期化観測）、または急激な低下（景気減速・デフレ懸念）。",
      caveat: "CPIと基調は似るが算出方法（対象範囲・ウェイト）が異なるため、両者に乖離が出ることがある。CPIより公表が遅い点にも注意。",
    },
    referenceLines: [{ value: 2, label: "FRBの物価目標 2%", kind: "target" }],
    releaseSchedule: "BEAが対象月の翌月末ごろ、個人所得・支出統計の一部として8:30 ETに公表。",
    api: { provider: "fred", seriesId: "PCEPILFE", transform: "yoy", statName: "PCE Price Index Excluding Food and Energy (BEA)" },
  },
  {
    id: "unemployment_rate_us",
    importance: 3,
    name: "失業率",
    shortName: "失業率",
    category: "雇用・所得",
    unit: "%",
    unitLabel: "%",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "down",
    description:
      "BLSが公表する、労働力人口に占める失業者の割合。雇用統計（Employment Situation）の一部として" +
      "非農業部門雇用者数と同時に毎月第1金曜日に発表される、市場が最も注目する経済指標の一つ。",
    judgment: {
      summary: "低いほど雇用情勢は良好とされるが、下がりすぎると人手不足による賃金・物価上昇圧力（インフレ再燃）という副作用も出てくる。",
      goodWhen: "4%前後で安定的に推移している状態（FRBが目安とする『自然失業率』に近い水準）。",
      badWhen: "3か月移動平均が過去12か月の最低値から0.5%ポイント以上上昇（景気後退の経験則『サーム・ルール』の目安。詳細・弱点は本ツールの「サーム・ルール」指標を参照）。",
      caveat: "求職をあきらめた人は労働力人口に含まれず失業率に反映されないため、実態より低く出ることがある。非農業部門雇用者数と合わせて見る。",
    },
    referenceLines: [{ value: 4, label: "自然失業率の目安 4%前後", kind: "target" }],
    // サーム・ルールの計算そのもの（3か月移動平均 − 過去12か月の最低値）をグラフ上で
    // 確認できるようにする。4%の目安ライン（kind: target）と色が被らないよう、
    // 個別に色を指定する（target色は既に4%ラインで使用済みのため）。
    movingAverage: {
      window: 3,
      label: "3か月移動平均",
      color: "accent",
      rollingMin: { window: 12, label: "過去12か月の最低値", color: "neutral" },
    },
    releaseSchedule: "BLSが毎月第1金曜日8:30 ETに、非農業部門雇用者数と同時発表。",
    api: { provider: "fred", seriesId: "UNRATE", transform: "level", statName: "Unemployment Rate (BLS)" },
  },
  {
    id: "sahm_rule_us",
    importance: 4,
    name: "サーム・ルール（景気後退シグナル）",
    shortName: "サーム・ルール",
    category: "雇用・所得",
    unit: "%",
    unitLabel: "%ポイント（失業率3か月移動平均の、過去12か月最低値からの上昇幅）",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "down",
    description:
      "FRBエコノミストだったクラウディア・サーム氏が考案した景気後退の経験則。失業率（季節調整済み）の" +
      "3か月移動平均が、過去12か月間の最低値と比べてどれだけ上昇したかを示す。1950年以降の米国の景気後退" +
      "11回すべてで、この値が0.5ポイントを超えたことが確認されており、『最も的中率の高い景気後退シグナル" +
      "の一つ』として知られる。本ツールは公表当時そのままの未改定データを使う『リアルタイム版』" +
      "（SAHMREALTIME）を採用しており、後年のBLSによる改定を反映しない、実際の運用に近い値を表示する。",
    judgment: {
      summary:
        "0.5ポイントを超えると『景気後退がすでに始まっている可能性が高い』という経験則のシグナル。ただし" +
        "失業率という『結果』の水準だけを見る指標のため、上昇の“原因”までは区別できない点に注意。",
      goodWhen: "0付近、またはマイナス圏で推移している状態（雇用情勢が悪化していない）。",
      badWhen: "0.5ポイントを超えている状態。過去の実績上、景気後退の最中である可能性が高い水準。",
      caveat:
        "【重要な弱点】このルールは失業率の“水準”だけを見ており、上昇の原因が「企業の解雇（労働需要の" +
        "縮小）」なのか「労働力人口の増加（移民増加などによる労働供給の拡大）」なのかを区別できない。" +
        "実際に2024年には考案者本人のサーム氏が『移民急増による労働供給拡大が要因の可能性があり、今回は" +
        "過去の教訓が当てはまらないかもしれない』と留保をつけた。この弱点を補うには、本ツールの" +
        "「新規失業保険申請件数」（解雇の直接的な指標。低水準のままなら解雇主導の悪化ではない可能性が" +
        "高い）と「非農業部門雇用者数」（雇用者数そのものが増加を続けているなら、失業率の上昇は労働供給" +
        "拡大＝働き手が増えたことが主因の可能性が高い）を必ず併せて確認すること。",
    },
    referenceLines: [{ value: 0.5, label: "景気後退シグナルの目安 0.5ポイント", kind: "target" }],
    releaseSchedule: "BLSが毎月第1金曜日に発表する失業率（雇用統計）を基に、本ツールが自動計算・取得。",
    api: {
      provider: "fred",
      seriesId: "SAHMREALTIME",
      transform: "level",
      statName: "Real-time Sahm Rule Recession Indicator (Federal Reserve Bank of St. Louis)",
    },
  },
  {
    id: "nonfarm_payrolls_us",
    importance: 5,
    name: "非農業部門雇用者数",
    shortName: "非農業部門雇用者数",
    category: "雇用・所得",
    unit: "千人",
    unitLabel: "前月差（千人）",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "BLSが毎月公表する、農業部門を除く雇用者数の前月からの増減。通称『NFP』。米国の毎月の経済指標の" +
      "中で最も市場を動かすとされる指標で、発表日は『雇用統計の金曜日』として世界中のトレーダーが注視する。",
    judgment: {
      summary: "プラスが続けば雇用拡大＝景気拡大のサイン。ただし『強すぎる』増加はインフレ再燃・利上げ観測につながり、株安要因になることもある（Good News is Bad Newsの局面）。",
      goodWhen: "月間15万〜25万人程度の増加が続く、景気を支えつつ過熱しない『適温』な状態。",
      badWhen: "急激な減少・マイナス転換（雇用の急速な悪化）、または逆に強すぎる増加が続きインフレ・利上げ観測を強める場合。",
      caveat: "発表後に大幅改定されることが多く（過去2か月分が同時に改定）、速報値だけで判断すると誤ることがある。",
    },
    referenceLines: [{ value: 0, label: "0＝増加・減少の分岐", kind: "neutral" }],
    releaseSchedule: "BLSが毎月第1金曜日8:30 ETに公表。",
    api: { provider: "fred", seriesId: "PAYEMS", transform: "mom_diff", statName: "All Employees, Total Nonfarm (BLS)" },
  },
  {
    id: "real_earnings_yoy_us",
    importance: 3,
    name: "実質週給（フルタイム労働者）",
    shortName: "実質週給",
    category: "雇用・所得",
    unit: "%",
    unitLabel: "前年同期比 %（実質）",
    frequency: "quarterly",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "BLSが公表する、フルタイム労働者の週給の中央値を物価で割り引いた実質値の前年同期比。" +
      "雇用の『量』（非農業部門雇用者数・失業率）だけでは分からない、家計の実質的な購買力の伸びを示す。",
    judgment: {
      summary: "プラスなら物価上昇を上回るペースで賃金が伸びている（実質的な購買力が増加）、マイナスなら物価上昇に賃金が追いついていない状態。",
      goodWhen: "プラス圏で推移している状態。",
      badWhen: "マイナスが継続している状態（名目賃金が増えていても物価上昇に負けている＝実質的な生活水準の低下）。",
      caveat: "四半期・中央値ベースの集計のため、月次の平均時給統計（Average Hourly Earnings）とは動きが異なることがある。",
    },
    referenceLines: [{ value: 0, label: "0%＝実質増減の分岐", kind: "neutral" }],
    releaseSchedule: "BLSが四半期終了の約1か月後に公表。",
    api: { provider: "fred", seriesId: "LES1252881600Q", transform: "yoy", statName: "Usual Weekly Real Earnings, Full-Time Wage and Salary Workers (BLS)" },
  },
  {
    id: "jobless_claims_us",
    importance: 3,
    name: "新規失業保険申請件数",
    shortName: "新規失業保険申請",
    category: "雇用・所得",
    unit: "件",
    unitLabel: "件（週間の新規申請件数）",
    frequency: "weekly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "down",
    description:
      "米国労働省が毎週公表する、失業保険を新規に申請した人数。月次の雇用統計より速報性が高く、" +
      "雇用情勢の変化をいち早く捉える指標として、FRBや市場が毎週注視している。",
    judgment: {
      summary: "低いほど雇用は堅調、急増は雇用情勢の急速な悪化のサイン。",
      goodWhen: "20万件台前半〜半ばで安定的に推移している状態。",
      badWhen: "30万件を超えて上昇傾向にある状態（景気後退の警戒サインとされることが多い）。",
      caveat: "祝日・天候（ハリケーン等）・自動車工場の一時休業などで単週の数値が大きく振れることがある。4週移動平均で基調を見るのが一般的（グラフにも重ねて表示）。",
    },
    referenceLines: [{ value: 300000, label: "景気後退の警戒目安 30万件", kind: "target" }],
    // 単週の振れが大きい指標のため、詳細グラフに4週移動平均を重ねて基調を見やすくする
    // （30万件の目安ライン＝kind:targetと色が被らないよう個別に色を指定）。
    movingAverage: { window: 4, label: "4週移動平均", color: "accent" },
    releaseSchedule: "米国労働省が毎週木曜日8:30 ETに公表。",
    api: { provider: "fred", seriesId: "ICSA", transform: "level", since: "2016-01-01", statName: "Initial Claims (U.S. Department of Labor)" },
  },
  {
    id: "job_openings_us",
    importance: 4,
    name: "JOLTS求人件数",
    shortName: "JOLTS求人件数",
    category: "雇用・所得",
    unit: "千件",
    unitLabel: "千件",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "BLSが公表する『雇用動態調査（JOLTS）』のうち、企業が募集している求人の件数。非農業部門雇用者数や" +
      "失業率が雇用の『結果』を示すのに対し、こちらは企業の採用意欲という『需要側』を映す。FRBが労働市場の" +
      "需給逼迫度（求人数と失業者数の比率など）を判断する際に重視する。",
    judgment: {
      summary: "求人が多いほど労働需要が強く、企業の採用意欲が旺盛な状態。ただし多すぎる求人は人手不足による賃金・物価上昇圧力にもつながる。",
      goodWhen: "緩やかに減少しながらも高水準を維持している状態（過熱していた労働需給が『軟着陸』しつつある局面）。",
      badWhen: "急激な減少（企業が採用を凍結し始めているサイン。しばしば本格的な雇用悪化・レイオフに先行する）。",
      caveat: "非農業部門雇用者数より公表が1か月ほど遅く、速報性に劣る。改定も大きいことがあるため、単月の増減より数か月のトレンドで判断する。",
    },
    referenceLines: [],
    releaseSchedule: "BLSが対象月の翌々月上旬ごろ（雇用統計の約1か月後）に公表。",
    api: { provider: "fred", seriesId: "JTSJOL", transform: "level", statName: "Job Openings: Total Nonfarm (BLS, JOLTS)" },
  },
  {
    id: "current_account_us",
    importance: 2,
    name: "経常収支",
    shortName: "経常収支",
    category: "対外",
    unit: "百万ドル",
    unitLabel: "百万ドル",
    frequency: "quarterly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "BEAが四半期ごとに公表する、貿易・サービス・海外投資からの所得まで含めた対外収支の総合指標。" +
      "米国は長年、大幅な経常赤字（＝海外からの資本流入に依存する構造）が続いている。",
    judgment: {
      summary: "米国は構造的に経常赤字が常態化しており、黒字化そのものを目指す指標ではない。赤字幅の急拡大・急縮小など『変化の大きさ』に注目する。",
      goodWhen: "赤字幅が安定的、または緩やかに縮小している状態。",
      badWhen: "赤字幅が急速に拡大している状態（海外からの資本流入への依存度が急速に高まっているサイン）。",
      caveat: "米国の経常赤字は、ドルが世界の基軟通貨であることの裏返しという側面もあり、日本のような『稼ぐ力』の指標として単純比較はできない。",
    },
    referenceLines: [{ value: 0, label: "0＝黒字・赤字の分岐", kind: "neutral" }],
    releaseSchedule: "BEAが四半期終了の約3か月後に公表。",
    api: { provider: "fred", seriesId: "IEABC", transform: "level", statName: "Balance on Current Account (BEA)" },
  },
  {
    id: "trade_balance_us",
    importance: 2,
    name: "貿易収支",
    shortName: "貿易収支",
    category: "対外",
    unit: "百万ドル",
    unitLabel: "百万ドル",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description: "Census Bureau・BEAが毎月公表する、モノとサービスの輸出額から輸入額を引いた収支。経常収支の中で最も速報性が高い内訳。",
    judgment: {
      summary: "経常収支と同様、米国は構造的な貿易赤字が常態化している。赤字幅の変化の背景（内需の強さによる輸入増か、輸出の弱さか）を見ることが重要。",
      goodWhen: "輸出の増加を伴う赤字縮小（海外需要・輸出競争力の強さを反映）。",
      badWhen: "内需の過熱や関税政策等を背景にした輸入急増による赤字急拡大。",
      caveat: "為替（ドル高・ドル安）や関税政策の影響を強く受ける。単月の振れだけで貿易構造の変化と判断しない。",
    },
    referenceLines: [{ value: 0, label: "0＝黒字・赤字の分岐", kind: "neutral" }],
    releaseSchedule: "Census Bureau・BEAが対象月の翌々月上旬ごろに公表。",
    api: { provider: "fred", seriesId: "BOPGSTB", transform: "level", statName: "Trade Balance: Goods and Services (Census Bureau/BEA)" },
  },
  {
    id: "fed_funds_rate_us",
    importance: 5,
    name: "FF金利（政策金利）",
    shortName: "FF金利",
    category: "金利",
    unit: "%",
    unitLabel: "％（実効フェデラルファンド金利・月中平均）",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "FRB（連邦準備制度理事会）が金融政策の誘導目標として運営する政策金利（フェデラルファンド金利）の" +
      "実効値。米国のみならず世界中の金利・為替・株式市場に影響する、最も重要な金利。FOMC（連邦公開市場" +
      "委員会）で年8回、変更の有無が決定される。",
    judgment: {
      summary: "『高い・低い』自体に良し悪しはなく、変化の方向とその理由（景気拡大に伴う正常化か、景気後退への対応か）が重要。急激な変化は世界の市場にショックを与える。",
      goodWhen: "緩やかな利上げ（経済の正常な成長・物価安定を反映）、または景気後退局面での機動的な利下げ。",
      badWhen: "急激な利上げ（借入コスト急増・株式のバリュエーション悪化、特にハイテク・成長株に逆風）、または後手に回った対応。",
      caveat: "FOMC会合（年8回）の結果を受けて段階的に変わるため、会合前後で市場の思惑により大きく振れやすい。10年国債利回りと合わせてイールドカーブを見ると金融環境をより正確に把握できる。",
    },
    referenceLines: [{ value: 0, label: "0%＝ゼロ金利との分岐", kind: "neutral" }],
    releaseSchedule: "月次平均値はFRBが翌月初旬に公表。「次回発表予定日」はFRBが公式発表するFOMC会合の最終日（政策決定発表日）を表示している。",
    // FEDFUNDSはFRED上で「H.15 Selected Interest Rates」というほぼ毎営業日更新される
    // リリースの一部として扱われており、FREDのNext Release Dateメタデータをそのまま使うと
    // 月次平均値の更新日ともFOMC会合の日程とも一致しない誤った日付になる（詳細は
    // fetch-fomc-calendar.mjs参照）。そのためFF金利だけは次回発表予定日の取得元を
    // FRB公式のFOMC会合カレンダーに切り替える。
    nextReleaseSource: { type: "fomc" },
    api: { provider: "fred", seriesId: "FEDFUNDS", transform: "level", statName: "Federal Funds Effective Rate (Federal Reserve)" },
  },
  {
    id: "treasury_10y_us",
    importance: 5,
    name: "米10年国債利回り",
    shortName: "米10年金利",
    category: "金利",
    unit: "%",
    unitLabel: "%（日次終値）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "新規発行の米10年国債の利回り（日次）。世界の長期金利の指標（ベンチマーク）であり、住宅ローン金利・" +
      "企業の資金調達コスト・株式のバリュエーション（益回りとの比較）に直結する、金融市場で最も注視される金利。",
    judgment: {
      summary: "政策金利は『いま』の短期金利にすぎない。10年国債利回りは市場参加者による将来の景気・物価・金融政策見通しを織り込んで動く。",
      goodWhen: "緩やかな上昇（景気拡大・適度な物価上昇を伴う『良い金利上昇』）。",
      badWhen: "急激な上昇（住宅ローン・企業の借入コスト急増、株式特にグロース株のバリュエーション悪化）や財政懸念を反映した上昇。",
      caveat: "借り手（住宅ローン利用者・企業）にとっては低いほど有利、貸し手・年金運用者にとっては高いほど有利と、立場によって『良い』の意味が逆転する。",
    },
    referenceLines: [{ value: 0, label: "0%＝ゼロ金利との分岐", kind: "neutral" }],
    releaseSchedule: "米財務省・FRBが毎営業日、取引終了後に公表。",
    api: { provider: "fred", seriesId: "DGS10", transform: "level", since: "2016-01-01", statName: "10-Year Treasury Constant Maturity Rate (Federal Reserve)" },
  },
  {
    id: "fed_balance_sheet_us",
    importance: 3,
    name: "FRBバランスシート（総資産）",
    shortName: "FRB総資産",
    category: "金利",
    unit: "百万ドル",
    unitLabel: "百万ドル（週次）",
    frequency: "weekly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "FRBが保有する国債・MBS等の資産総額（週次）。量的緩和（QE）で拡大し、量的引き締め（QT）で縮小する、" +
      "金融政策のもう一つの柱。市場の流動性環境を映す指標として、政策金利と合わせて注視される。",
    judgment: {
      summary: "水準そのものより、拡大から縮小への転換など『方向性の変化』が金融市場にとって重要なシグナルとなる。",
      goodWhen: "市場の予想の範囲内で緩やかに推移している状態（政策の予見可能性が高い）。",
      badWhen: "急激な縮小（QTの急加速＝市場から資金が急速に吸収される、株式には逆風）や、逆に急激な拡大（金融不安への緊急対応のサイン）。",
      caveat: "2022年以降、FRBは量的引き締め（QT）を継続しており、緩やかな縮小トレンドにあること自体は『異常事態』ではない。",
    },
    referenceLines: [],
    releaseSchedule: "FRBが毎週木曜日（H.4.1統計）に公表。",
    api: { provider: "fred", seriesId: "WALCL", transform: "level", since: "2016-01-01", statName: "Total Assets (Federal Reserve H.4.1)" },
  },
  {
    id: "yield_curve_spread_us",
    importance: 5,
    name: "長短金利差（10年-2年国債利回り）",
    shortName: "長短金利差",
    category: "金利",
    unit: "%",
    unitLabel: "%ポイント（10年債-2年債、日次）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "米10年国債利回りから2年国債利回りを差し引いた、長短金利の差。通称『イールドカーブ』の形状を" +
      "示す代表的な指標で、これがマイナスになる『逆イールド』は、過去数十年の米国の景気後退の多くに" +
      "先行して発生してきた、最も有名な景気後退の予兆指標の一つ。",
    judgment: {
      summary: "プラス（順イールド）が平常な状態。マイナス（逆イールド）は、短期金利が長期金利を上回る" +
        "異例の状態で、市場が将来の利下げ・景気減速を織り込んでいることを示唆する。",
      goodWhen: "小幅〜中程度のプラス圏で安定的に推移している状態（正常なイールドカーブ）。",
      badWhen: "マイナス（逆イールド）が長期間続く状態。ただし歴史的には『逆イールドが解消してプラスに" +
        "転じるタイミング（un-inversion）』の方が、実際の景気後退開始・株価下落により近いとの指摘もある。",
      caveat: "逆イールド発生から実際の景気後退までには、過去平均で1〜2年程度のタイムラグがあることが多い。" +
        "『いつ』景気後退が来るかの精密なタイミング予測には使えない点に注意。",
    },
    referenceLines: [{ value: 0, label: "0＝逆イールド（景気後退シグナル）との分岐", kind: "neutral" }],
    releaseSchedule: "米財務省・FRBが毎営業日、取引終了後に公表。",
    api: { provider: "fred", seriesId: "T10Y2Y", transform: "level", since: "2016-01-01", statName: "10-Year Treasury Minus 2-Year Treasury (Federal Reserve)" },
  },
  {
    id: "dollar_index_us",
    importance: 4,
    name: "貿易加重ドル指数",
    shortName: "ドル指数",
    category: "為替・市場",
    unit: "",
    unitLabel: "指数（2006年1月=100）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "FRBが算出する、主要貿易相手国通貨に対するドルの実力を総合的に示す指数（貿易加重・広範ベース）。" +
      "個別通貨ペアより米国全体の輸出競争力・多国籍企業の海外収益への影響を捉えやすい。",
    judgment: {
      summary: "ドル高は輸入物価の抑制・海外資産の割安化に働く一方、米国の多国籍企業の海外収益（ドル換算）を目減りさせ、輸出競争力を弱める。ドル安はその逆。",
      goodWhen: "（株式市場にとっては）緩やかなドル安、または行き過ぎたドル高からの是正（多国籍企業の海外収益にプラス）。",
      badWhen: "急激な変動（無秩序なドル高・ドル安）。企業の業績予想の不確実性を高める。",
      caveat: "米国株の時価総額の多くを占める多国籍企業にとっては、ドル高は海外売上の目減り要因。輸出企業には不利、逆に輸入コストが下がる内需企業には有利、と業種によって影響が異なる。",
    },
    referenceLines: [{ value: 100, label: "基準期間(2006年1月)=100", kind: "context" }],
    releaseSchedule: "FRBが毎営業日（H.10統計）に公表。",
    api: { provider: "fred", seriesId: "DTWEXBGS", transform: "level", since: "2016-01-01", statName: "Trade Weighted U.S. Dollar Index: Broad (Federal Reserve H.10)" },
  },
  {
    id: "sp500_us",
    importance: 5,
    name: "S&P500種株価指数",
    shortName: "S&P500",
    category: "為替・市場",
    unit: "",
    unitLabel: "ポイント（日次終値）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "S&P ダウ・ジョーンズ・インデックスが算出する、米国の代表的な大型株500銘柄で構成される時価総額" +
      "加重型の株価指数。米国株式市場全体、ひいては世界の株式市場のセンチメントを示す最も基本的な指標。",
    judgment: {
      summary: "他の指標と異なり、これ自体が市場参加者による経済・企業業績の先読みの結果。上昇は景気拡大・企業業績改善への期待、下落はその逆を織り込む。",
      goodWhen: "緩やかな右肩上がりのトレンド（企業業績の拡大を伴う持続的な上昇）。",
      badWhen: "急落（数日〜数週間で10%を超えるような下落＝調整局面入り）や、ファンダメンタルズと乖離した過熱感を伴う急騰の反動。",
      caveat: "上位数銘柄（ハイテク大型株）の影響が大きい時価総額加重指数のため、指数全体の動きが市場全体の実態を必ずしも反映しない局面がある（値がさ株偏重）。",
    },
    referenceLines: [],
    releaseSchedule: "取引時間中は常時更新。本ツールは日次終値を採用。",
    api: { provider: "fred", seriesId: "SP500", transform: "level", since: "2016-01-01", statName: "S&P 500 (S&P Dow Jones Indices)" },
  },
  {
    id: "vix_us",
    importance: 5,
    name: "VIX指数（恐怖指数）",
    shortName: "VIX",
    category: "為替・市場",
    unit: "",
    unitLabel: "ポイント（日次終値）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "down",
    description:
      "シカゴ・オプション取引所（CBOE）が算出する、S&P500オプション価格から逆算した『今後30日間の予想" +
      "変動率』。通称『恐怖指数』。市場参加者のリスク許容度・不安心理を数値化した、株式市場のセンチメント" +
      "を最も直接的に示す指標。",
    judgment: {
      summary: "数値が高いほど市場が『恐怖』（不安・警戒）を織り込んでいる状態、低いほど『平穏』な状態。",
      goodWhen: "20を下回って安定的に推移している状態（市場が落ち着いている）。",
      badWhen: "30を超えて急上昇している状態（強いリスクオフ・株式の急落局面で典型的に見られる）。",
      caveat: "VIX自体は結果指標であり、これが原因で株価が動くというより、株価の急落・不透明感の高まりの『結果』として跳ね上がることが多い。ただし現代の市場ではボラティリティ連動戦略のファンドが機械的に売買するため、VIX急騰がさらなる株安を招く側面もある。",
    },
    referenceLines: [{ value: 20, label: "平常時の目安 20", kind: "target" }],
    releaseSchedule: "CBOEが取引時間中常時算出。本ツールは日次終値を採用。",
    api: { provider: "fred", seriesId: "VIXCLS", transform: "level", since: "2016-01-01", statName: "CBOE Volatility Index: VIX (Cboe)" },
  },
  {
    id: "building_permits_us",
    importance: 3,
    name: "新築住宅建築許可件数",
    shortName: "建築許可件数",
    category: "景気",
    unit: "千戸",
    unitLabel: "千戸（年率換算・季節調整値）",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "新築住宅の建築を自治体が許可した件数（年率換算）。許可を受けてから着工するため、住宅着工や建設活動の" +
      "『先行指標』とされる。住宅は金利の影響を最も受けやすい分野で、景気先行指数（LEI）の構成要素にも" +
      "含まれる。",
    judgment: {
      summary: "水準そのものより、数か月単位で増えているか減っているかの方向を見る。住宅市場の先行きと、金利が実体経済に効いているかを探る材料になる。",
      goodWhen: "数か月にわたって増加傾向にある状態（住宅需要や建設意欲が回復している）。",
      badWhen: "数か月連続で大きく減少している状態（金利の高止まりや景気不安で、建設を控える動きが広がっている）。",
      caveat: "単月の振れが大きく、後から改定される。大型の集合住宅の許可で単月だけ跳ねることもあるため、3か月程度の傾向で見る。",
    },
    referenceLines: [],
    releaseSchedule: "米国センサス局が、新築住宅着工・許可件数として毎月中旬ごろに公表。",
    api: { provider: "fred", seriesId: "PERMIT", transform: "level", statName: "New Private Housing Units Authorized by Building Permits (U.S. Census Bureau)" },
  },
  {
    id: "mortgage_rate_us",
    importance: 3,
    name: "30年固定住宅ローン金利",
    shortName: "住宅ローン金利",
    category: "金利",
    unit: "%",
    unitLabel: "%（週次・30年固定の平均）",
    frequency: "weekly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "住宅金融機関のフレディマックが毎週調査する、30年固定住宅ローンの平均金利。米国の住宅購入の負担を" +
      "直接左右し、住宅販売・着工・住宅関連の消費に影響する。",
    judgment: {
      summary: "米10年国債利回りに連動して動く。ローン金利が上がると、住宅購入の月々の支払いが増えて住宅市場が冷えやすく、下がると逆の動きになる。",
      goodWhen: "緩やかな低下、または安定している状態（住宅購入の負担が重くならない）。",
      badWhen: "急上昇が続く状態（購入負担が急増し、住宅販売や着工が冷え込みやすい）。",
      caveat: "FRBの政策金利が直接決めるものではなく、10年国債利回りに上乗せされる幅（スプレッド）で決まる。借りる人には低いほど有利、貸す側には高いほど有利と、立場によって『良い』の意味が逆になる。",
    },
    referenceLines: [],
    releaseSchedule: "フレディマックが毎週木曜日に公表。",
    api: { provider: "fred", seriesId: "MORTGAGE30US", transform: "level", since: "2016-01-01", statName: "30-Year Fixed Rate Mortgage Average in the United States (Freddie Mac)" },
  },
  {
    id: "credit_spread_us",
    importance: 4,
    name: "社債の信用スプレッド（Baa社債利回り-米10年債）",
    shortName: "信用スプレッド",
    category: "金利",
    unit: "%",
    unitLabel: "%ポイント（Baa社債利回り-10年国債利回り、日次）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "down",
    description:
      "投資適格の中では格付けが低めの社債（Baa格）の利回りから、米10年国債の利回りを引いた差。企業が" +
      "資金を借りるときに上乗せされる『リスクの上乗せ幅』で、投資家が企業の返済力をどれだけ心配しているかを" +
      "示す。景気後退や金融不安の局面で広がりやすく、景気先行指数にも信用の指標が含まれる。",
    judgment: {
      summary: "差が狭いほど信用環境は良好、急に広がるときは企業の資金繰りへの不安が高まっているサイン。",
      goodWhen: "低めの水準で安定している状態（投資家が企業向け融資・社債に安心している）。",
      badWhen: "短期間で急拡大している状態（過去の景気後退や金融不安の局面で大きく広がった）。",
      caveat: "金利水準そのものではなく『差』のため、国債利回りの動き次第でも変わる。株価・VIXなどの市場指標と合わせて確認すると判断しやすい。",
    },
    referenceLines: [],
    releaseSchedule: "ムーディーズの社債利回りと米財務省の国債利回りから、毎営業日算出。",
    api: { provider: "fred", seriesId: "BAA10Y", transform: "level", since: "2016-01-01", statName: "Moody's Baa Corporate Bond Yield Relative to 10-Year Treasury (Moody's, FRB)" },
  },
  {
    id: "philly_fed_us",
    importance: 3,
    name: "フィラデルフィア連銀 製造業景況指数",
    shortName: "フィラデルフィア連銀景況",
    category: "景気",
    unit: "",
    unitLabel: "DI（景況判断指数、0が拡大・縮小の分岐）",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "フィラデルフィア連銀が管内の製造業者に毎月行う調査から算出する、現在の景況感の指数。『良い』と答えた" +
      "企業の割合から『悪い』と答えた企業の割合を引いた値で、ISM製造業景況指数のような全国調査が無料で" +
      "得られないため、全米の製造業の動きを探る代わりの指標として広く参照される。",
    judgment: {
      summary: "0を上回れば製造業の活動が拡大していると答える企業が多く、下回れば縮小していると答える企業が多い。",
      goodWhen: "プラス圏で推移している状態（製造業の受注・生産が拡大している）。",
      badWhen: "マイナス圏で推移している、または急低下している状態（製造業の景況感が悪化している）。",
      caveat: "ペンシルベニア東部・ニュージャージー南部・デラウェア州の企業が対象の地域調査で、月ごとの振れが大きい。全米の動きとは一致しないこともあるため、3か月程度の傾向で見る。",
    },
    referenceLines: [{ value: 0, label: "0＝拡大・縮小の分岐", kind: "neutral" }],
    releaseSchedule: "フィラデルフィア連銀が毎月第3木曜日ごろに公表。",
    api: { provider: "fred", seriesId: "GACDFSA066MSFRBPHI", transform: "level", statName: "Philadelphia Fed Manufacturing Business Outlook Survey: Current General Activity (SA)" },
  },
  {
    id: "breakeven_inflation_us",
    importance: 4,
    name: "10年ブレークイーブン・インフレ率",
    shortName: "期待インフレ率（10年）",
    category: "物価",
    unit: "%",
    unitLabel: "%（今後10年の平均、日次）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "物価連動国債（TIPS）と通常の国債の利回りの差から、債券市場が織り込んでいる『今後10年間の平均物価上昇率』" +
      "を逆算した値。FRBが物価への信認（インフレ期待が安定しているか）を確認するために重視する市場の指標。",
    judgment: {
      summary: "市場が予想する将来のインフレ率。2%前後で安定していれば、物価の先行きに対する信認が保たれていると見られる。",
      goodWhen: "2%前後で安定している状態（インフレ期待が落ち着いている）。",
      badWhen: "急上昇している状態（インフレ再加速の織り込み）。逆に急低下も、景気後退やデフレ懸念を織り込んでいる可能性がある。",
      caveat: "予想というより債券市場の需給や流動性の影響も受ける。CPI連動のため、FRBが目標とするPCE物価より高めに出やすく、2%の線はあくまで参考。",
    },
    referenceLines: [{ value: 2, label: "参考：2%（物価安定の目安）", kind: "context" }],
    releaseSchedule: "FRBが毎営業日、取引終了後に公表。",
    api: { provider: "fred", seriesId: "T10YIE", transform: "level", since: "2016-01-01", statName: "10-Year Breakeven Inflation Rate (Federal Reserve)" },
  },
  {
    id: "wti_oil_us",
    importance: 3,
    name: "WTI原油価格",
    shortName: "WTI原油",
    category: "為替・市場",
    unit: "ドル",
    unitLabel: "ドル/バレル（日次）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "米国の代表的な原油価格（WTI）。ガソリン・輸送費・電気代などを通じて物価を左右し、家計や企業の負担にも" +
      "なる。一方でエネルギー産業には追い風になるなど、経済への影響が一方向ではない。",
    judgment: {
      summary: "原油高は物価を押し上げて家計・企業の負担になり、原油安は逆。急変動のときは、需要の変化（景気）か供給の変化（産油国・地政学）かを見分けることが大切。",
      goodWhen: "穏やかな範囲で安定している状態（物価や景気への影響が小さい）。",
      badWhen: "短期間での急騰（物価上昇と消費の圧迫）、または急落（世界の需要減速を示唆）。",
      caveat: "景気が良くて上がる場合と、供給不安で上がる場合では、意味が逆になる。産油国の供給調整や地政学リスクでも大きく動く。",
    },
    referenceLines: [],
    releaseSchedule: "米エネルギー情報局（EIA）が毎営業日公表。FREDへの反映は数日遅れることがある。",
    api: { provider: "fred", seriesId: "DCOILWTICO", transform: "level", since: "2016-01-01", statName: "Crude Oil Prices: West Texas Intermediate (EIA)" },
  },
];

export const CATEGORIES = ["景気", "物価", "雇用・所得", "対外", "金利", "為替・市場"];

/**
 * カテゴリごとの「まず見る指標／次に見る指標（補完）」ガイド。
 * id は INDICATORS の id と対応させる。
 */
export const CATEGORY_GUIDES = {
  景気: {
    first: {
      id: "gdp_growth_us",
      reason: "米国経済全体の拡大・縮小を最も包括的に示す『結果』の指標。ただし四半期に1度、対象期間終了から約1か月後という遅いペースでしか発表されない。",
    },
    second: {
      id: "industrial_production_us",
      reason: "GDPは速報性に欠けるため、毎月発表される鉱工業生産指数で補う。製造業を中心とした実体経済の動きを、次のGDP発表までの『空白期間』も追いかけられる。",
    },
  },
  物価: {
    first: {
      id: "cpi_yoy_us",
      reason: "米国で最も報道される物価指標で、FRBの利上げ・利下げ観測に直結する。",
    },
    second: {
      id: "core_pce_yoy_us",
      reason: "CPIは一般向けの報道で最も目立つが、FRBが実際の金融政策判断で参照するのはコアPCE。両方を見ることで、市場の反応（CPI）とFRBの本音の判断材料（コアPCE）の両方を押さえられる。",
    },
  },
  "雇用・所得": {
    first: {
      id: "nonfarm_payrolls_us",
      reason: "米国の月次指標の中で最も市場を動かすとされる『雇用の量』の指標。失業率と同時に毎月第1金曜日に発表される。",
    },
    second: {
      id: "real_earnings_yoy_us",
      reason: "非農業部門雇用者数や失業率は『雇用の量』（仕事があるかどうか）を示すが、暮らし向きに直結するのは『所得の質』。実質週給を合わせて見ることで、物価上昇に賃金が追いついているかまで確認できる。",
    },
  },
  対外: {
    first: {
      id: "current_account_us",
      reason: "貿易・サービス・海外投資からの所得まで含めた、対外収支の総合指標。",
    },
    second: {
      id: "trade_balance_us",
      reason: "経常収支は所得収支等の影響も受け実体経済の『モノを売る力』が見えにくい。貿易収支を合わせて見ることで、輸出入の実態をより直接的に把握できる。",
    },
  },
  金利: {
    first: {
      id: "fed_funds_rate_us",
      reason: "FRBが金融政策の誘導目標として運営する政策金利。利上げ・利下げという金融政策そのものの動きを直接示す起点となる金利で、世界の市場に影響する。",
    },
    second: {
      id: "treasury_10y_us",
      reason: "政策金利は『いま』の短期金利にすぎない。米10年国債利回り（長期金利）を合わせて見ることで、市場が将来の利上げ・利下げや景気・物価見通しをどう織り込んでいるかという『将来予想』を補完できる。",
    },
  },
  "為替・市場": {
    first: {
      id: "sp500_us",
      reason: "米国株式市場全体の『いま』を示す、最も基本的な株価指数。まずはここで市場の値動きの大きさを把握する。",
    },
    second: {
      id: "vix_us",
      reason: "S&P500の値動き（結果）だけでは『どれだけの不安・警戒感を伴っているか』が分からない。VIX（恐怖指数）を合わせて見ることで、値動きの背景にある市場心理の強さを確認できる。",
    },
  },
};
