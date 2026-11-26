import PostEditorScreen from "@/features/posts/PostEditorScreen";

type RouteParams = { id: string };

export default async function EditPostRoute({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;

  return <PostEditorScreen postId={id} />;
}
