import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { currentPassword, newEmail, newPassword } = body;

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Current password is required" },
      { status: 400 }
    );
  }

  const supabase = createClient();

  // Verify current password
  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("id, email, password_hash")
    .eq("id", session.user.id)
    .single();

  if (fetchError || !user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 403 }
    );
  }

  // Build update object
  const updates: Record<string, string> = {};

  if (newEmail && newEmail !== user.email) {
    // Check if email is already taken
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", newEmail)
      .neq("id", session.user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Email is already in use" },
        { status: 409 }
      );
    }

    updates.email = newEmail;
  }

  if (newPassword) {
    updates.password_hash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No changes to apply" });
  }

  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", session.user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update account: " + updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Account updated successfully" });
}
