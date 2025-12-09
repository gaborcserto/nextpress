import PageEditorScreen from "@/components/admin/PageEditorScreen";

type RouteParams = { id: string };

type EditPageRouteProps = {
  params: Promise<RouteParams>;
};

export default async function EditPageRoute({ params }: EditPageRouteProps) {
  const { id } = await params;

  return <PageEditorScreen id={id} />;
}
