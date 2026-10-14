# LUNAレンタルサロン 作業メモ

## 予約サイトの掲載ページ(Asteria つくば)

- インスタベース: https://www.instabase.jp/space/6549920978?cat=salon
  - 掲載者の編集画面: https://www.instabase.jp/partners/rooms/8347263577/space/6549920978/
  - 公開ページは CloudFront で最大6時間キャッシュされる。最新を見るときは
    `https://www.instabase.jp/space/6549920978//` のように末尾を変えて取得する。
  - 料金・オプションの入力は税抜、表示は税込(+10%)。
- スペースマーケット: https://www.spacemarket.com/spaces/luna_asteria/
  - 取得時は Cookie `sm_geo_ok=1` を付ける(付けないと 429 の読み込み画面になる)。
  - ページ内の `__NEXT_DATA__` に説明文・料金・オプションが入っている。

## 注意

- インスタベース・スペースマーケットの掲載文では、自社サイトなど外部への誘導をしない(各サイトの規約)。
