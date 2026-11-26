import RevisionEditor from "@/features/content/RevisionEditor/RevisionEditor";

export default async function RevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RevisionEditor kind="posts" pageId={(await params).id} />;
}
