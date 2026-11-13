import {
  TaxonomyArchive,
  taxonomyArchiveMetadata,
} from "@/components/public-content/TaxonomyArchive";
import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export function generateMetadata(props: PageProps) {
  return taxonomyArchiveMetadata({ ...props, type: "TAG" });
}

export default function TaxonomyPage(props: PageProps) {
  return (
    <PublicWebsiteShell>
      <TaxonomyArchive {...props} type="TAG" />
    </PublicWebsiteShell>
  );
}
