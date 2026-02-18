import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const session = await auth();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session!.user.id)
    .single();

  const { data: categories } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("user_id", session!.user.id)
    .order("name");

  return (
    <>
      <Header title="Settings" userName={profile?.full_name} userEmail={session?.user?.email} />
      <div className="p-4 md:p-6 max-w-3xl">
        <ProfileForm
          profile={profile}
          userId={session!.user.id}
          userEmail={session!.user.email!}
          categories={categories ?? []}
        />
      </div>
    </>
  );
}
