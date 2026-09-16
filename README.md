# LUNAレンタルサロン 店舗運営ダッシュボード

チャット内プロトタイプ(`luna_dashboard.jsx`)を、SQLiteで永続化する本格的なWebアプリとして再構築したもの。仕様は `LUNA_DASHBOARD_SPEC.md`(元 `luna_dashboard_spec.md`)を参照。

## 構成

- `server/` — Node.js(Express)+ SQLite(Node組み込みの `node:sqlite`)。集計ロジック・CSVインポートAPI。
- `client/` — React + Vite + Tailwind CSS + Recharts。ダッシュボードUI。

Node.js **v22.5 以上**が必要(`node:sqlite` を使用しているため)。

## セットアップ

```bash
npm run install:all   # server / client の依存関係をインストール
npm run dev            # サーバー(:3001)とクライアント(:5173)を同時起動
```

初回起動時、`server/data/luna_usage_2023-2026.csv` の実績データ(約4,800件)が自動的にSQLiteへ投入されます(`server/luna.db`、2回目以降は再投入されません)。

ブラウザで `http://localhost:5173` を開くとダッシュボードが表示されます。

## 本番起動(単一デプロイ)

```bash
npm run build   # client をビルド
npm start        # client の dist を Express から配信しつつ API サーバーを起動(:3001 のみ)
```

Vercel / Render などシンプルなホスティング先へは `server` をNodeアプリとしてデプロイし、`npm run build && npm start` 相当のコマンドを実行すれば単一プロセスで動作します。

## データモデル

```
transactions(
  id, date, store, user_name, revenue, hours_used,
  start_hour, weekday, channel, status, created_at
)
store_settings(
  store, area, color, open_date, operating_hours_per_day, sort_order
)
```

`store_settings` に開業日(`open_date`)・1日あたり稼働可能時間(`operating_hours_per_day`)を保存しており、画面右上の「店舗設定」から編集できます(仕様書 7.3 の「基準日・店舗開業日をハードコードしない」要件に対応)。`open_date` を空欄にすると、実績データ上のその店舗の初回利用日から自動推定されます。

基準日(本日)は仕様書 4.4 のとおりサーバーの現在日時(JST)から動的に算出しており、設定値としては保持していません。

## 集計ロジック(仕様書 4章のビジネスルール)

`server/src/aggregations.js` に実装。プロトタイプの `useMemo` ロジックを1:1で移植しつつ、`status` 列に基づいて売上・稼働時間を判定するよう変更しています(`server/src/config.js` の `REVENUE_STATUSES` / `HOURS_USED_STATUSES`)。

- 稼働可能時間:店舗ごとに `operating_hours_per_day × 営業日数`(開業日〜基準日/年末の早い方)
- 売上:ステータスが「利用済み」「キャンセル(返金あり)」の金額のみ計上
- 稼働時間:ステータスが「利用済み」の予約のみ計上
- 年度比較:暦年ベース

## CSVインポート

ヘッダーは英語(`date,store,user,revenue,hoursUsed,hour,weekday,channel`)・日本語(`日付,店舗,利用者,売上,利用時間,hour,weekday,channel`)のどちらにも対応(`server/src/importRows.js`)。`status`/`ステータス` 列を明示的に含めることもでき、省略時は売上・稼働時間の値から自動推定します。画面の「テンプレートDL」から取り込み用CSVのひな形をダウンロードできます。インポートは追加(アペンド)方式で、未登録の店舗名はCSVに含まれていれば自動的に店舗設定へ登録されます。

## 仕様書からの未確定事項(要本人確認・引き継ぎ)

- Forest(2024-10-31〜)・Asteria(2026-04-10〜)の開業日は実績データからの自動推定値。実際の契約開業日と異なる場合は「店舗設定」画面から修正してください。
- 稼働可能時間 14時間/日 が実際の営業時間と一致しているか。
- 集客チャネル(導線)は今後、予約システム側または入力フォームで明示的に持たせる設計への移行を推奨(現行はCSV列としてのみ管理)。
- 「定期クーポン」(サブスク収入・店舗非紐付け)は現行どおり店舗別集計から除外。別収益ラインとして扱うかは要検討。
