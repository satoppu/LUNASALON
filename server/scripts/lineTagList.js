// LINE公式アカウントのチャットで「つくば」「柏」のタグを手で付けるための一覧を作る。
// 利用実績(キャンセルを除く)から、お客様ごとに使った店舗を集め、
//   つくば = Asteria だけ / 柏 = Bellezza・Forest だけ / 両方 = 両方使っている
// に分ける。LINEの表示名と照らし合わせやすいよう、よやクル会員の表示名も添える。
// インスタベース・スペースマーケットだけのお客様は LINE の友だちでないことが多いため、
// 各グループの最後に分けて出す。
//
// ターミナルでは日本語が文字化けすることがあるため、--email を付けるとメールで送る
// (Excel で開ける CSV を添付)。
// Usage:
//   node scripts/lineTagList.js           # 画面に出す
//   node scripts/lineTagList.js --email   # メールで送る
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const { default: db } = await import("../src/db.js");
const { HOURS_USED_STATUSES } = await import("../src/config.js");
const { canonicalizeUserName } = await import("../src/importHelpers.js");

const OWN_SITE = "自社サイト";
const TSUKUBA = new Set(["Asteria"]);
const KASHIWA = new Set(["Bellezza", "Forest"]);

const statuses = [...HOURS_USED_STATUSES];
const rows = db
  .prepare(
    `SELECT date, store, user_name, channel FROM transactions
     WHERE hours_used > 0 AND user_name IS NOT NULL AND user_name != '' AND status IN (${statuses.map(() => "?").join(",")})`
  )
  .all(...statuses);

// よやクル会員の表示名(名前 → 表示名)。
const handleByName = new Map();
for (const c of db.prepare(`SELECT name, hn FROM yoyakul_customers WHERE name IS NOT NULL`).all()) {
  if (c.hn && c.hn !== c.name) handleByName.set(canonicalizeUserName(c.name), c.hn);
}

const customers = new Map();
for (const r of rows) {
  const c = customers.get(r.user_name) ?? { name: r.user_name, stores: {}, channels: new Set(), last: "" };
  c.stores[r.store] = (c.stores[r.store] ?? 0) + 1;
  c.channels.add(r.channel);
  if (r.date > c.last) c.last = r.date;
  customers.set(r.user_name, c);
}

const groupOf = (c) => {
  const names = Object.keys(c.stores);
  const t = names.some((s) => TSUKUBA.has(s));
  const k = names.some((s) => KASHIWA.has(s));
  return t && k ? "両方" : t ? "つくば" : k ? "柏" : null;
};
const GROUPS = [
  { key: "つくば", title: "つくば(Asteriaだけ)" },
  { key: "柏", title: "柏(Bellezza・Forestだけ)" },
  { key: "両方", title: "両方(つくばと柏の両方を利用)" },
];

const storeText = (c) =>
  Object.entries(c.stores)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${s}${n}回`)
    .join("・");
const dateText = (iso) => `${Number(iso.slice(0, 4)) % 100}/${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const lineFor = (c) => {
  const hn = handleByName.get(c.name);
  return `・${c.name}${hn ? `(よやクル表示名: ${hn})` : ""} ${storeText(c)} 最終${dateText(c.last)}`;
};

const sections = [];
const csv = [["タグ", "お名前", "よやクル表示名", "店舗別の利用回数", "最終利用日", "予約経路", "自社サイトの利用"]];
const totals = {};
for (const g of GROUPS) {
  const list = [...customers.values()].filter((c) => groupOf(c) === g.key).sort((a, b) => b.last.localeCompare(a.last));
  const own = list.filter((c) => c.channels.has(OWN_SITE));
  const platformOnly = list.filter((c) => !c.channels.has(OWN_SITE));
  totals[g.key] = { own: own.length, platformOnly: platformOnly.length };
  sections.push(
    [
      `■ ${g.title} 自社サイトの利用あり ${own.length}名`,
      ...(own.length ? own.map(lineFor) : ["・なし"]),
      "",
      `  (参考)インスタベース・スペースマーケットだけ ${platformOnly.length}名 — LINEの友だちでないことが多い`,
      ...platformOnly.map((c) => `  ${lineFor(c)}`),
    ].join("\n")
  );
  for (const c of list) {
    csv.push([g.key, c.name, handleByName.get(c.name) ?? "", storeText(c), c.last, [...c.channels].join("・"), c.channels.has(OWN_SITE) ? "あり" : "なし"]);
  }
}

const text = [
  "LINEのチャットで「つくば」「柏」のタグを付けるための一覧です(キャンセルを除く利用実績から作成)。",
  "LINEの表示名が予約時のお名前と違う方もいるため、よやクルの表示名も添えています。",
  "",
  ...GROUPS.map((g) => `${g.key}: 自社サイトの利用あり ${totals[g.key].own}名(ほかに予約サイトだけ ${totals[g.key].platformOnly}名)`),
  "",
  sections.join("\n\n"),
].join("\n");

if (process.argv.includes("--email")) {
  const { sendResultEmail } = await import("../src/notifyEmail.js");
  const body = "﻿" + csv.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  await sendResultEmail({
    subject: "【LUNA】LINEタグ付け用のお客様一覧(つくば・柏)",
    text,
    attachments: [{ filename: "line-tags.csv", content: body, contentType: "text/csv; charset=utf-8" }],
  });
  console.log("メールで送りました。");
} else {
  console.log(text);
}
