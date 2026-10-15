// 前年比(相対増減率)表示の共通ヘルパー。複数ページ(概要・稼働率・導線分析)
// で同じ計算/バッジ表示を使うため、元はSummaryPageだけにあった実装をここに
// 切り出したもの。前年値が無い/0なら比較不能としてnullを返す。
export function pctChange(current, prior) {
  if (prior == null || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function YoyBadge({ pct, className = "" }) {
  if (pct == null) return null;
  return (
    <span className={`ml-1.5 ${className}`} style={{ color: pct >= 0 ? "#D4A644" : "#D66B5C" }}>
      ({pct >= 0 ? "+" : ""}
      {pct.toFixed(1)}%)
    </span>
  );
}
