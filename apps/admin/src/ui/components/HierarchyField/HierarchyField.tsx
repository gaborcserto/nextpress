"use client";

import { useEffect, useState } from "react";

import { jsonResult } from "@/lib/api";
import { Select } from "@/ui/primitives";

import type { HierarchyFieldProps, PageOption } from "./HierarchyField.types";

export default function HierarchyField({
  parentId,
  onChangeAction,
}: HierarchyFieldProps) {
  const [options, setOptions] = useState<PageOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    jsonResult<PageOption[]>("/api/pages?select=parent").then(([data, err]) => {
      if (cancelled) return;
      setOptions(!err && data ? data : []);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Select
      label="Parent page"
      fullWidth
      value={parentId ?? ""}
      options={[
        { value: "", label: "(no parent)" },
        ...options.map((p) => ({ value: p.id, label: p.title })),
      ]}
      onChangeAction={(val) => onChangeAction(val ? String(val) : null)}
    />
  );
}
