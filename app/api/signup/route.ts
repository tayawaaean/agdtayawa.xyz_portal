import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, password, full_name } = await request.json();

    if (!email || !password || !full_name) {
      return Response.json({ error: "All fields are required" }, { status: 400 });
    }

    // Check if user already exists
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return Response.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({ email, password_hash: passwordHash, full_name })
      .select("id")
      .single();

    if (userError || !user) {
      return Response.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Create profile
    await supabase
      .from("profiles")
      .insert({ id: user.id, email, full_name });

    // Create default expense categories
    const categories = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      user_id: user.id,
      name,
      is_default: true,
    }));
    await supabase.from("expense_categories").insert(categories);

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
