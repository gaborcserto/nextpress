import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";

import Preview from "./Preview";

export const metadata = { robots: { index: false, follow: false } };

export default function PreviewPage() {
  return (
    <PublicWebsiteShell>
      <Preview adminOrigin={process.env.PREVIEW_ADMIN_ORIGIN ?? ""} />
    </PublicWebsiteShell>
  );
}
