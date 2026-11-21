"use client";

import { useEffect, useId, useState } from "react";
import { z } from "zod";

import { ApiRequestError, jsonResult } from "@/lib/api";
import { useAdminDateLocale } from "@/lib/settings/admin-date-time";
import { Button, Select } from "@/ui/primitives";

import type { HierarchyFieldProps, PageOption } from "./HierarchyField.types";

const pageOptions = z.array(z.object({ id: z.string(), title: z.string() }));

type Lookup =
  | { status: "loading" | "failed" | "unauthorized" }
  | { status: "loaded"; options: PageOption[] };

export default function HierarchyField({
  parentId,
  onChangeAction,
}: HierarchyFieldProps) {
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const selectId = useId();
  const hu = useAdminDateLocale() === "hu";

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const [data, error] = await jsonResult<unknown>(
        "/api/pages?select=parent",
        {
          signal: controller.signal,
        },
      );

      if (controller.signal.aborted) {
        return;
      }

      const parsed = pageOptions.safeParse(data);

      if (!error && parsed.success) {
        setLookup({ status: "loaded", options: parsed.data });
      } else if (
        error instanceof ApiRequestError &&
        [401, 403].includes(error.status)
      ) {
        setLookup({ status: "unauthorized" });
      } else {
        setLookup({ status: "failed" });
      }
    }

    void load();

    return () => controller.abort();
  }, [attempt]);

  function retry() {
    document.getElementById(selectId)?.focus();
    setLookup({ status: "loading" });
    setAttempt(attempt + 1);
  }

  const options = lookup.status === "loaded" ? lookup.options : [];
  const loading = lookup.status === "loading";
  const failure =
    lookup.status === "unauthorized"
      ? hu
        ? "Nincs jogosultsága a szülőoldalak megtekintéséhez."
        : "You do not have access to the parent pages."
      : lookup.status === "failed"
        ? hu
          ? "A szülőoldalak nem tölthetők be."
          : "Unable to load parent pages."
        : undefined;

  return (
    <>
      <Select
        id={selectId}
        label={hu ? "Szülőoldal" : "Parent page"}
        fullWidth
        value={parentId ?? ""}
        error={failure}
        options={[
          {
            value: "",
            label: hu ? "(nincs szülőoldal)" : "(no parent)",
            disabled: lookup.status !== "loaded",
          },
          ...(parentId && !options.some(({ id }) => id === parentId)
            ? [
                {
                  value: parentId,
                  label: hu ? "Jelenlegi szülőoldal" : "Current parent page",
                },
              ]
            : []),
          ...options.map(({ id, title }) => ({ value: id, label: title })),
        ]}
        onChangeAction={(val) => onChangeAction(val ? String(val) : null)}
      />
      <p role="status">
        {loading && (hu ? "Szülőoldalak betöltése…" : "Loading parent pages…")}
        {lookup.status === "loaded" &&
          !options.length &&
          (hu ? "Nincsenek elérhető szülőoldalak." : "No Pages found.")}
      </p>
      {lookup.status === "failed" && (
        <Button onClick={retry}>{hu ? "Újrapróbálkozás" : "Retry"}</Button>
      )}
    </>
  );
}
