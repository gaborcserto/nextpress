import { FaSearch } from "react-icons/fa";

import { AdminIconButton, Input, type InputProps } from "@/ui/primitives";

export type ToolbarSearchWidth = "bounded" | "responsive";

type ToolbarSearchProps = Omit<
  InputProps,
  "size" | "fullWidth" | "rightIcon"
> & {
  submitLabel?: string;
  width?: ToolbarSearchWidth;
};

export function ToolbarSearch({
  submitLabel,
  width = "bounded",
  ...props
}: ToolbarSearchProps) {
  return (
    <div className="admin-toolbar-search" data-width={width}>
      <Input
        size="sm"
        fullWidth
        rightIcon={submitLabel ? undefined : <FaSearch size={14} />}
        {...props}
      />
      {submitLabel && (
        <AdminIconButton
          type="submit"
          aria-label={submitLabel}
          title={submitLabel}
          variant="ghost"
          size="sm"
          icon={FaSearch}
          iconSize={14}
          disabled={props.disabled}
          className="admin-plain-icon-button admin-search-submit"
        />
      )}
    </div>
  );
}
