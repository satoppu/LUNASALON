// レシート画像/PDFから日付・金額・内容を読み取り、勘定科目と店舗の候補を
// 付けて返す(経費一覧の「手動で追加」フォームの下書き用)。最終的な登録は
// 人が確認してから行う前提なので、迷うものは空欄で返させる。
import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_CATEGORIES } from "./expensesService.js";

const MODEL = "claude-opus-5-5";

const SCHEMA = {
  type: "object",
  properties: {
    date: { type: "string", description: "利用日 YYYY-MM-DD。読み取れなければ空文字" },
    amount: { type: "integer", description: "支払った合計金額(税込・円)。読み取れなければ0" },
    description: { type: "string", description: "「店名(主な品目)」の形。例: ダイソー(マット・スリッパ)" },
    category: { type: "string", enum: EXPENSE_CATEGORIES },
    store: { type: "string", enum: ["", "Bellezza", "Forest", "Asteria"] },
  },
  required: ["date", "amount", "description", "category", "store"],
  additionalProperties: false,
};

const SYSTEM = `あなたはレンタルサロン「LUNA」の経費入力を手伝います。レシートや領収書の画像から、経費一覧に登録する内容を読み取ってください。

店舗は3つあります: Bellezza(柏)、Forest(柏)、Asteria(つくば)。
- 店舗(store)は、品目やメモから特定の店舗用だと明らかな場合だけ入れ、判断できなければ空文字にしてください。購入した店の所在地だけでは決めないでください。
- 勘定科目(category)は、サロンの備品・日用品・タオルや装飾品などは「消耗品費」、ネット・電話・サーバー・LINE公式などは「通信費」、予約システムなどのサービス利用料は「システム利用料」、電気・ガス・水道は「水道光熱費」、振込手数料・カード年会費は「支払手数料」、分類しづらい少額のものは「雑費」を基本にしてください。
- 金額(amount)は、値引きやポイント利用を差し引いた、実際に支払った税込の合計です。
- 内容(description)は短く「店名(主な品目)」の形で書いてください。`;

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isReceiptScanEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function isScannableType(mimeType) {
  return mimeType === "application/pdf" || SUPPORTED_IMAGE_TYPES.has(mimeType);
}

export async function scanReceipt(buffer, mimeType) {
  // .env は index.js の import 後に読み込まれるため、クライアントは呼び出し時に作る。
  const client = new Anthropic();
  const data = buffer.toString("base64");
  const fileBlock =
    mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data } };

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: "このレシートを読み取ってください。" }] }],
  });

  if (response.stop_reason === "refusal") throw new Error("このレシートは読み取れませんでした。");
  if (response.stop_reason === "max_tokens") throw new Error("読み取りが途中で終わりました。もう一度お試しください。");
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("読み取り結果が空でした。");
  return JSON.parse(text);
}
