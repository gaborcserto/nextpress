"use client";

import type { MenuPlacementFieldProps } from "./MenuPlacementField.types";
import { Checkbox } from "@/ui/primitives";

/**
 * Two checkboxes controlling header/footer menu placement.
 */
export default function MenuPlacementField({
  inHeader,
  inFooter,
  onChangeAction,
}: MenuPlacementFieldProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium mb-1">
        Menu placement
      </legend>

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
    </fieldset>
  );
}
