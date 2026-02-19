"use server";

import { signOut as nextAuthSignOut } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function createSessionCookie(user: { id: string; email: string; full_name: string }) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");

  const isSecure = process.env.NODE_ENV === "production";
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.full_name,
      sub: user.id,
    },
    secret,
    salt: cookieName,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password required" };
  }

  const supabase = getServiceClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, password_hash, full_name")
    .eq("email", email)
    .single();

  if (error || !user) {
    return { error: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  try {
    await createSessionCookie(user);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create session" };
  }

  return { success: true };
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;

  if (!email || !password || !fullName) {
    return { error: "All fields are required" };
  }

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
    return { error: "Failed to create account: " + (userError?.message ?? "") };
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

  // Auto sign-in
  try {
    await createSessionCookie({ id: user.id, email, full_name: fullName });
  } catch (err) {
    return { error: "Account created but sign-in failed: " + (err instanceof Error ? err.message : "") };
  }

  return { success: true };
}

export async function signOut() {
  await nextAuthSignOut({ redirectTo: "/login" });
}
