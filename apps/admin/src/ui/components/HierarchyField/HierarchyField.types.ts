"use client";

export type PageOption = {
  id: string;
  title: string;
};

export type HierarchyFieldProps = {
  parentId: string | null;
  onChangeAction: (value: string | null) => void;
};
