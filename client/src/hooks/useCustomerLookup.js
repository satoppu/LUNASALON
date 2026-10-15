import { useEffect, useState } from "react";
import { api } from "../api.js";

// Shared across any page that lists customer names (利用履歴, 利用者ランキング,
// ...) so each can open the same CustomerDetailModal without re-fetching or
// re-deriving the user->profile map itself.
export function useCustomerLookup() {
  const [customerByName, setCustomerByName] = useState(new Map());

  useEffect(() => {
    api
      .getCustomers()
      .then((res) => setCustomerByName(new Map(res.customers.map((c) => [c.user, c]))))
      .catch(() => {});
  }, []);

  return customerByName;
}
