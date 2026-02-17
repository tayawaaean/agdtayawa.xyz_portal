import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ProjectDetail } from "@/components/projects/project-detail";
import { notFound } from "next/navigation";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, client:clients(id, company_name)")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, default_hourly_rate")
    .eq("id", session!.user.id)
    .single();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("status", "active")
    .order("company_name");

  const { data: timeEntries } = await supabase
    .from("time_entries")
    .select("*")
    .eq("project_id", id)
    .order("date", { ascending: false });

  const { data: milestones } = await supabase
    .from("project_milestones")
    .select("*")
    .eq("project_id", id)
    .order("sort_order");

  return (
    <>
      <Header
        title={project.name}
        userName={profile?.full_name}
        userEmail={session?.user?.email}
      />
      <div className="p-4 md:p-6">
        <ProjectDetail
          project={project}
          clients={clients ?? []}
          timeEntries={timeEntries ?? []}
          milestones={milestones ?? []}
          userId={session!.user.id}
          defaultRate={profile?.default_hourly_rate}
        />
      </div>
    </>
  );
}
