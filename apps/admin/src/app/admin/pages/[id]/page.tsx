import EditPageScreen from "@/components/admin/EditPageScreen/EditPageScreen";

export default async function EditPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditPageScreen id={id} />;
}
