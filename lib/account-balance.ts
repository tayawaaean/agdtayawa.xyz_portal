import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountType } from "@/lib/types";

/**
 * Update an account's balance when an expense is created or deleted.
 *
 * - Credit card: "add" increases balance (you owe more), "remove" decreases it.
 * - Bank account: "add" decreases balance (money spent), "remove" increases it.
 */
export async function updateAccountBalance(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  amount: number,
  accountType: AccountType,
  operation: "add" | "remove",
  note?: string
) {
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("current_balance")
    .eq("id", accountId)
    .single();

  if (fetchError || !account) return;

  const current = Number(account.current_balance);
  let delta: number;

  if (accountType === "credit_card") {
    // Credit card: spending increases balance owed
    delta = operation === "add" ? amount : -amount;
  } else {
    // Bank account: spending decreases balance
    delta = operation === "add" ? -amount : amount;
  }

  const newBalance = Math.round((current + delta) * 100) / 100;

  await Promise.all([
    supabase
      .from("accounts")
      .update({ current_balance: newBalance })
      .eq("id", accountId),
    supabase.from("account_balance_history").insert({
      account_id: accountId,
      user_id: userId,
      balance: newBalance,
      note: note || `Expense ${operation === "add" ? "created" : "removed"}`,
    }),
  ]);
}
