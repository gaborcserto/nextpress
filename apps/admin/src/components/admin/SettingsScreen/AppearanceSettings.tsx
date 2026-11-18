"use client";

import {
  AppearanceCatalogSchema,
  AppearanceSchema,
  PublicAppearanceSchema,
} from "@nextpress/shared";
import { useEffect, useState, type FormEvent } from "react";

import { jsonFetcher } from "@/lib/api";
import { Alert, Button, Section, Select } from "@/ui/primitives";

import type { z } from "zod";

const endpoint = "/api/admin/settings/appearance";
const SelectionSchema = PublicAppearanceSchema.extend({
  colorMode: AppearanceSchema.shape.colorMode,
});

type AppearanceSelection = z.infer<typeof SelectionSchema>;
type AppearanceCatalog = z.infer<typeof AppearanceCatalogSchema>;

function readSelection(payload: unknown, catalog: AppearanceCatalog) {
  const selection = SelectionSchema.parse(payload);
  const template = catalog.find(({ id }) => id === selection.websiteTemplate);

  if (!template?.presets.some(({ id }) => id === selection.stylePreset)) {
    throw new Error("Appearance is unavailable in the catalog");
  }

  return selection;
}

export default function AppearanceSettings() {
  const [catalog, setCatalog] = useState<AppearanceCatalog>([]);
  const [selection, setSelection] = useState<AppearanceSelection | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const options = { cache: "no-store", signal: controller.signal } as const;

    void Promise.all([
      jsonFetcher<unknown>(endpoint, options),
      jsonFetcher<unknown>(`${endpoint}/catalog`, options),
    ])
      .then(([appearance, metadata]) => {
        if (controller.signal.aborted) {
          return;
        }

        const templates = AppearanceCatalogSchema.parse(metadata);
        const active = readSelection(appearance, templates);
        setCatalog(templates);
        setSelection(active);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
        }
      });

    return () => controller.abort();
  }, [attempt]);

  const template = catalog.find(({ id }) => id === selection?.websiteTemplate);

  function changeSelection(next: AppearanceSelection) {
    setSelection(next);
    setSaved(false);
    setSaveError(null);
  }

  async function saveAppearance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selection || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const response = await jsonFetcher<unknown>(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      setSelection(readSelection(response, catalog));
      setSaved(true);
    } catch {
      setSaveError(
        "Unable to confirm the appearance change. Check your session or reload Settings and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Appearance"
      desc="Choose the appearance used on the public website."
    >
      {loadFailed && (
        <>
          <Alert status="error" message="Unable to load website appearance." />
          <Button
            onClick={() => {
              setLoadFailed(false);
              setAttempt((previous) => previous + 1);
            }}
          >
            Retry loading appearance
          </Button>
        </>
      )}
      {!loadFailed && !selection && <p role="status">Loading appearance…</p>}
      {selection && template && (
        <form
          className="space-y-4"
          onSubmit={(event) => void saveAppearance(event)}
        >
          <fieldset className="grid gap-4 sm:grid-cols-3" disabled={saving}>
            <Select
              label="Website template"
              fullWidth
              options={catalog.map(({ id, label }) => ({ value: id, label }))}
              value={selection.websiteTemplate}
              onChangeAction={(value) => {
                const next = catalog.find(({ id }) => id === value);

                if (next) {
                  changeSelection({
                    ...selection,
                    websiteTemplate: next.id,
                    stylePreset: next.defaultPreset,
                  });
                }
              }}
            />
            <Select
              label="Style variant"
              fullWidth
              options={template.presets.map(({ id, label }) => ({
                value: id,
                label,
              }))}
              value={selection.stylePreset}
              onChangeAction={(value) => {
                const preset = template.presets.find(({ id }) => id === value);

                if (preset) {
                  changeSelection({ ...selection, stylePreset: preset.id });
                }
              }}
            />
            <Select
              label="Website color mode"
              fullWidth
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              value={selection.colorMode}
              onChangeAction={(value) => {
                const mode = SelectionSchema.shape.colorMode.safeParse(value);

                if (mode.success) {
                  changeSelection({ ...selection, colorMode: mode.data });
                }
              }}
            />
          </fieldset>
          <Alert status="error" message={saveError} />
          <Button type="submit" color="primary" loading={saving}>
            Save appearance
          </Button>
          <p role="status">{saved ? "Appearance saved." : ""}</p>
        </form>
      )}
    </Section>
  );
}
