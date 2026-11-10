import RevisionEditor from "@/components/admin/RevisionEditor";

export default async function CompositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RevisionEditor pageId={(await params).id} />;
}
