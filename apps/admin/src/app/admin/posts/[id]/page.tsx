import EditPostScreen from "@/components/admin/EditPostScreen/EditPostScreen";

type Props = { params: Promise<{ id: string }> };

export default async function EditPostRoute({ params }: Props) {
  const { id } = await params;

  return <EditPostScreen postId={id} />;
}
