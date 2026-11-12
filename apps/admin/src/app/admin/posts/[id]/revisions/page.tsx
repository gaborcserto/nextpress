import RevisionEditor from "@/components/admin/RevisionEditor";

export default async function RevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RevisionEditor kind="posts" pageId={(await params).id} />;
}
