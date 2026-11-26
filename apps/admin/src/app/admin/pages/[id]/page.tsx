import PageEditorScreen from "@/features/pages/PageEditorScreen";

type RouteParams = { id: string };

export default async function EditPageRoute({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;

  return <PageEditorScreen id={id} />;
}
