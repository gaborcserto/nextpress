import { UiText } from "@/lib/i18n/client";

export default function Loading() {
  return (
    <p role="status">
      <UiText id="search.loading" />
    </p>
  );
}
