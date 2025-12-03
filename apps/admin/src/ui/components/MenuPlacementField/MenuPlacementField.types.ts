export type MenuPlacementFieldProps = {
  inHeader: boolean;
  inFooter: boolean;
  onChangeAction: (
    key: "inHeaderMenu" | "inFooterMenu",
    value: boolean
  ) => void;
};
