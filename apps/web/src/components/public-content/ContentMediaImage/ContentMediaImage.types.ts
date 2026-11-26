import type { ImageProps } from "next/image";

export type PreviewMediaLoader = (
  id: string,
  signal: AbortSignal,
) => Promise<ArrayBuffer | null>;

export type MediaProps = Pick<
  ImageProps,
  "alt" | "loading" | "sizes" | "style"
> & {
  src: string;
  gif?: boolean;
  width: number;
  height: number;
};
