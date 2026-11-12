import RevisionEditor from "@/components/admin/RevisionEditor";

export default async function RevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RevisionEditor pageId={(await params).id} />;
}
