"use client";

import {
  AppearanceCatalogSchema,
  AppearanceSchema,
  PublicAppearanceSchema,
} from "@nextpress/shared";
import { useEffect, useState } from "react";

import { jsonFetcher } from "@/lib/api";
import { AdminButton, Alert, Section, Select } from "@/ui/primitives";

import { useSettingsMessages } from "./messages";

import type { z } from "zod";

const endpoint = "/api/admin/settings/appearance";
const SelectionSchema = PublicAppearanceSchema.extend({
  colorMode: AppearanceSchema.shape.colorMode,
});

type AppearanceSelection = z.infer<typeof AppearanceSchema>;
type AppearanceCatalog = z.infer<typeof AppearanceCatalogSchema>;

function readSelection(payload: unknown, catalog: AppearanceCatalog) {
  const selection = AppearanceSchema.parse(payload);
  const template = catalog.find(({ id }) => id === selection.websiteTemplate);

  if (!template?.presets.some(({ id }) => id === selection.stylePreset)) {
    throw new Error("Appearance is unavailable in the catalog");
  }

  return selection;
}

function localizedCatalogLabel(
  id: string,
  fallback: string,
  labels: Readonly<Record<string, string>>,
) {
  return Object.entries(labels).find(([key]) => key === id)?.[1] ?? fallback;
}

export default function AppearanceSettings({
  onChangeAction,
}: {
  onChangeAction: (selection: AppearanceSelection, dirty: boolean) => void;
}) {
  const text = useSettingsMessages();
  const [catalog, setCatalog] = useState<AppearanceCatalog>([]);
  const [selection, setSelection] = useState<AppearanceSelection | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

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
        onChangeAction(active, false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
        }
      });

    return () => controller.abort();
  }, [attempt, onChangeAction]);

  const template = catalog.find(({ id }) => id === selection?.websiteTemplate);

  function changeSelection(next: AppearanceSelection) {
    setSelection(next);
    onChangeAction(next, true);
  }

  return (
    <Section title={text.appearance} desc={text.appearanceDescription}>
      {loadFailed && (
        <>
          <Alert status="error" message={text.appearanceLoadError} />
          <AdminButton
            onClick={() => {
              setLoadFailed(false);
              setAttempt((previous) => previous + 1);
            }}
          >
            {text.retryAppearance}
          </AdminButton>
        </>
      )}
      {!loadFailed && !selection && (
        <p role="status">{text.appearanceLoading}</p>
      )}
      {selection && template && (
        <div className="admin-appearance-settings-form">
          <fieldset className="grid min-w-0 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
            <Select
              label={text.template}
              fullWidth
              options={catalog.map(({ id, label }) => ({
                value: id,
                label: localizedCatalogLabel(id, label, text.catalog),
              }))}
              value={selection.websiteTemplate}
              onChangeAction={(value) => {
                const next = catalog.find(({ id }) => id === value);

                if (next) {
                  const websiteTemplate =
                    AppearanceSchema.shape.websiteTemplate.parse(next.id);
                  const stylePreset = AppearanceSchema.shape.stylePreset.parse(
                    next.defaultPreset,
                  );
                  changeSelection({
                    ...selection,
                    websiteTemplate,
                    stylePreset,
                  });
                }
              }}
            />
            <Select
              label={text.style}
              fullWidth
              options={template.presets.map(({ id, label }) => ({
                value: id,
                label: localizedCatalogLabel(id, label, text.catalog),
              }))}
              value={selection.stylePreset}
              onChangeAction={(value) => {
                const preset = template.presets.find(({ id }) => id === value);

                if (preset) {
                  changeSelection({
                    ...selection,
                    stylePreset: AppearanceSchema.shape.stylePreset.parse(
                      preset.id,
                    ),
                  });
                }
              }}
            />
            <Select
              label={text.colorMode}
              fullWidth
              options={[
                { value: "light", label: text.light },
                { value: "dark", label: text.dark },
                { value: "system", label: text.system },
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
        </div>
      )}
    </Section>
  );
}
