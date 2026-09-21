import { useEffect, useState } from "react";
import { api } from "../api.js";

// Shared across any page with a free-text 利用者名 input (キャビネット・クーポン,
// スペースマーケット手動入力, 利用履歴の検索, ...) so typing a surname offers
// existing names as datalist candidates instead of risking a typo.
export function useKnownUserNames() {
  const [userNames, setUserNames] = useState([]);

  useEffect(() => {
    api
      .getKnownUserNames()
      .then((res) => setUserNames(res.userNames))
      .catch(() => {});
  }, []);

  return userNames;
}
