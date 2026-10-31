// 一度きりの参考情報として登録しておく出来事(工事休業・新店オープンなど)。
// 日次・月次の自動集計だけでは分からない「なぜこの期間だけ売上が落ちた/
// 伸びたか」の背景を、サマリーの自動総括に反映するためのもの。
// stores: null = 全店舗対象。日付はヒアリングに基づく概算のため、正確な
// 日付が分かれば「設定」の管理画面から直接修正してください。
export const INITIAL_BUSINESS_EVENTS = [
  {
    startDate: "2026-03-24",
    endDate: "2026-04-06",
    stores: "Bellezza,Forest",
    note: "柏のエレベーター工事によりBellezza・Forestが一時休業(正確な期間は要確認)",
  },
  {
    startDate: "2026-04-10",
    endDate: "2026-04-10",
    stores: "Asteria",
    note: "Asteriaオープン(正確な開業日は要確認)",
  },
];
