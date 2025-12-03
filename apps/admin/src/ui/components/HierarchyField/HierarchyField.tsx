"use client";

import { useEffect, useState } from "react";

import type { HierarchyFieldProps, PageOption } from "./HierarchyField.types";
import { jsonResult } from "@/lib/api";
import Select from "@/ui/components/Select";

export default function HierarchyField({ parentId, onChangeAction }: HierarchyFieldProps) {
  const [options, setOptions] = useState<PageOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    jsonResult<PageOption[]>("/api/pages?select=parent")
      .then(([data, err]) => {
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
      placeholder="(no parent)"
      options={options.map((p) => ({ value: p.id, label: p.title }))}
      onChangeAction={(val) => onChangeAction(typeof val === "string" ? val : null)}
    />
  );
}
