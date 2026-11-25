import { redirect } from "next/navigation";

export default async function AdminDocumentsRoute({
  searchParams,
}: PageProps<"/admin/documents">) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") {
      query.set(key, value);
    }
  }

  query.set("kind", "document");
  redirect(`/admin/media?${query}`);
}
