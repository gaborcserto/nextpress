import {
  maxMenuDepth,
  type NavigationItemInput,
} from "@nextpress/shared/api-contracts";

export function ancestors(
  item: NavigationItemInput,
  items: NavigationItemInput[],
) {
  const result: string[] = [];
  let parent = item.parentId;

  while (parent && result.length < maxMenuDepth && !result.includes(parent)) {
    result.push(parent);
    parent = items.find(({ id }) => id === parent)?.parentId ?? null;
  }

  return result;
}

export function flattenMenuItems(items: NavigationItemInput[]) {
  const flattened: Array<{ item: NavigationItemInput; depth: number }> = [];

  function appendChildren(
    parentId: string | null,
    depth: number,
    branch: Set<string>,
  ) {
    if (depth >= maxMenuDepth) {
      return;
    }

    for (const item of items.filter((entry) => entry.parentId === parentId)) {
      if (branch.has(item.id)) {
        continue;
      }

      flattened.push({ item, depth });
      appendChildren(item.id, depth + 1, new Set([...branch, item.id]));
    }
  }

  appendChildren(null, 0, new Set());

  return flattened;
}

export type MenuDropProjection = {
  parentId: string | null;
  beforeId?: string;
  depth: number;
  index: number;
};

export const menuIndentSize = 16;

export function projectMenuItemDrop(
  items: NavigationItemInput[],
  id: string,
  slotIndex: number,
  requestedDepth: number,
  insideTargetId?: string,
): MenuDropProjection | null {
  const movingItem = items.find((item) => item.id === id);

  if (!movingItem) {
    return null;
  }

  if (insideTargetId) {
    return createMenuDropProjection(items, id, insideTargetId);
  }

  const remaining = flattenMenuItems(items).filter(
    ({ item }) => item.id !== id,
  );
  const boundedSlot = Math.max(0, Math.min(slotIndex, remaining.length));
  const preceding = remaining.slice(0, boundedSlot);
  const previous = preceding.at(-1);
  let depth = Math.max(
    0,
    Math.min(
      requestedDepth,
      maxMenuDepth - 1,
      previous ? previous.depth + 1 : 0,
    ),
  );
  let parentId: string | null = null;

  while (depth > 0) {
    const parent = preceding
      .slice()
      .reverse()
      .find(
        (entry) =>
          entry.depth === depth - 1 &&
          !ancestors(entry.item, items).includes(id),
      );

    if (parent) {
      parentId = parent.item.id;

      break;
    }

    depth -= 1;
  }

  const nextSibling = remaining
    .slice(boundedSlot)
    .find((entry) => entry.item.parentId === parentId);

  return createMenuDropProjection(items, id, parentId, nextSibling?.item.id);
}

export function projectMenuItemMove(
  items: NavigationItemInput[],
  id: string,
  parentId: string | null,
  beforeId?: string,
): MenuDropProjection | null {
  return createMenuDropProjection(items, id, parentId, beforeId);
}

export function menuDropPlaceholderIndex(
  items: NavigationItemInput[],
  target: MenuDropProjection,
) {
  const orderedItems = flattenMenuItems(items);

  if (target.beforeId) {
    const beforeIndex = orderedItems.findIndex(
      ({ item }) => item.id === target.beforeId,
    );

    if (beforeIndex >= 0) {
      return beforeIndex;
    }
  }

  if (!target.parentId) {
    return orderedItems.length;
  }

  const parentIndex = orderedItems.findIndex(
    ({ item }) => item.id === target.parentId,
  );

  if (parentIndex < 0) {
    return orderedItems.length;
  }

  const parentDepth = orderedItems[parentIndex]?.depth ?? 0;
  let placeholderIndex = parentIndex + 1;

  while (
    placeholderIndex < orderedItems.length &&
    (orderedItems[placeholderIndex]?.depth ?? 0) > parentDepth
  ) {
    placeholderIndex += 1;
  }

  return placeholderIndex;
}

function createMenuDropProjection(
  items: NavigationItemInput[],
  id: string,
  parentId: string | null,
  beforeId?: string,
): MenuDropProjection | null {
  const projectedItems = moveMenuItem(items, id, parentId, beforeId);

  if (!projectedItems) {
    return null;
  }

  const orderedItems = flattenMenuItems(projectedItems);
  const position = orderedItems.findIndex(({ item }) => item.id === id);

  if (position < 0) {
    return null;
  }

  const projectedItem = orderedItems[position];

  if (!projectedItem) {
    return null;
  }

  return {
    parentId,
    ...(beforeId && { beforeId }),
    depth: projectedItem.depth,
    index: position,
  };
}

export function moveMenuItem(
  items: NavigationItemInput[],
  id: string,
  parentId: string | null,
  beforeId?: string,
) {
  const item = items.find((entry) => entry.id === id);
  const parent = items.find((entry) => entry.id === parentId);

  if (!item || (parentId && !parent) || id === parentId || id === beforeId) {
    return null;
  }

  if (
    beforeId &&
    !items.some((entry) => entry.id === beforeId && entry.parentId === parentId)
  ) {
    return null;
  }

  const parentPath = parent ? ancestors(parent, items) : [];
  const subtreeDepth = Math.max(
    1,
    ...items.map((entry) => ancestors(entry, items).indexOf(id) + 2),
  );

  if (
    parentPath.includes(id) ||
    (parent ? parentPath.length + 1 : 0) + subtreeDepth > maxMenuDepth
  ) {
    return null;
  }

  const next = items.filter((entry) => entry.id !== id);
  const index = beforeId
    ? next.findIndex((entry) => entry.id === beforeId)
    : next.length;
  next.splice(index, 0, { ...item, parentId });

  return next;
}

export function moveMenuItemRelative(
  items: NavigationItemInput[],
  id: string,
  targetId: string,
  position: "before" | "after" | "inside" | "outdent",
) {
  const target = items.find((entry) => entry.id === targetId);

  if (!target || target.id === id) {
    return null;
  }

  if (position === "inside") {
    return moveMenuItem(items, id, target.id);
  }

  const parentId =
    position === "outdent"
      ? (ancestors(target, items)[1] ?? null)
      : target.parentId;

  if (position === "outdent") {
    return moveMenuItem(items, id, parentId, ancestors(target, items)[0]);
  }

  const targetIndex = items.findIndex((entry) => entry.id === target.id);
  const nextSibling =
    position === "after"
      ? items
          .slice(targetIndex + 1)
          .find((entry) => entry.parentId === target.parentId)
      : target;

  return moveMenuItem(items, id, parentId, nextSibling?.id);
}
