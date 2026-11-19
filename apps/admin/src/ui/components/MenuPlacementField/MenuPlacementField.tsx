"use client";

import { Checkbox } from "@/ui/primitives";

import type { MenuPlacementFieldProps } from "./MenuPlacementField.types";

/**
 * A page can appear in both public navigation regions.
 */
export default function MenuPlacementField({
  inHeader,
  inFooter,
  onChangeAction,
}: MenuPlacementFieldProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium mb-1">Menu placement</legend>
      <div className="admin-menu-placement-options">
        <Checkbox
          checked={inHeader}
          label="Show in header menu"
          onChangeAction={(checked) => onChangeAction("inHeaderMenu", checked)}
        />

        <Checkbox
          checked={inFooter}
          label="Show in footer menu"
          onChangeAction={(checked) => onChangeAction("inFooterMenu", checked)}
        />
      </div>
    </fieldset>
  );
}
