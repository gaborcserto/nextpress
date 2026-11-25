import { documentMime, MediaInputMimeSchema } from "@nextpress/shared/media";
import { Editor, Range, Transforms } from "slate";
import { HistoryEditor } from "slate-history";

import type { MediaAsset } from "@nextpress/shared/media";

export function insertRichAsset(
  editor: Editor,
  savedRange: Range | null,
  asset: MediaAsset,
): boolean {
  if (!HistoryEditor.isHistoryEditor(editor)) {
    return false;
  }

  const range = savedRange ?? editor.selection;

  if (
    !range ||
    !Editor.hasPath(editor, range.anchor.path) ||
    !Editor.hasPath(editor, range.focus.path)
  ) {
    return false;
  }

  const image = MediaInputMimeSchema.safeParse(asset.mime).success;
  const node = image
    ? {
        type: "image" as const,
        mediaId: asset.id,
        alt: asset.alt ?? "",
        width: asset.width,
        height: asset.height,
        children: [{ text: "" }] as [{ text: "" }],
      }
    : asset.mime === documentMime
      ? {
          type: "paragraph" as const,
          children: [
            {
              text: asset.caption || asset.filename || "PDF",
              href: `/media/${encodeURIComponent(asset.id)}`,
            },
          ],
        }
      : null;

  if (!node) {
    return false;
  }

  HistoryEditor.withNewBatch(editor, () => {
    Transforms.select(editor, range);

    if (Range.isExpanded(range)) {
      Transforms.delete(editor);
    }

    Transforms.insertNodes(editor, node, { select: true });
  });

  return true;
}
