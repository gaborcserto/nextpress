import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import Preview from "./Preview";

export const metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage() {
  const settings = await getPublicSiteSettings();
  const { listVariant } = resolveWebsiteAppearance(settings.appearance);

  return (
    <PublicWebsiteShell>
      <Preview
        adminOrigin={process.env.PREVIEW_ADMIN_ORIGIN ?? ""}
        appearance={{
          listVariant,
          postsPerPage: settings.postsPerPage,
          listingMode: settings.postListingMode,
        }}
      />
    </PublicWebsiteShell>
  );
}
