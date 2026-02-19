"use server";

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    return { error: "Invalid email or password" };
  }

  redirect("/");
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;

  const supabase = getServiceClient();

  // Check if user already exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return { error: "An account with this email already exists" };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ email, password_hash: passwordHash, full_name: fullName })
    .select("id")
    .single();

  if (userError || !user) {
    return { error: "Failed to create account" };
  }

  // Create profile
  await supabase
    .from("profiles")
    .insert({ id: user.id, email, full_name: fullName });

  // Create default expense categories
  const categories = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
    user_id: user.id,
    name,
    is_default: true,
  }));
  await supabase.from("expense_categories").insert(categories);

  // Sign in
  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    return { error: "Account created but sign-in failed. Please log in." };
  }

  redirect("/");
}

export async function signOut() {
  await nextAuthSignOut({ redirectTo: "/login" });
}
