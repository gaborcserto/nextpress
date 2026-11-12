import Preview from "./Preview";

export const metadata = { robots: { index: false, follow: false } };

export default function PreviewPage() {
  return <Preview adminOrigin={process.env.PREVIEW_ADMIN_ORIGIN ?? ""} />;
}
