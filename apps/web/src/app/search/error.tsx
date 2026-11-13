"use client";

import { UiText } from "@/lib/i18n/client";

export default function SearchError({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <p>
        <UiText id="search.error" />
      </p>
      <button type="button" onClick={reset}>
        <UiText id="errors.retry" />
      </button>
    </section>
  );
}
