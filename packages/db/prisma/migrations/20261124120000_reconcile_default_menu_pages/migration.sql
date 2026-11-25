UPDATE "NavigationItem" AS item
SET "kind" = 'content',
    "value" = page."id"
FROM "Page" AS page
WHERE item."menuId" = 'initial-header'
  AND item."kind" = 'internal'
  AND item."label" = ''
  AND item."parentId" IS NULL
  AND item."newTab" = false
  AND (
    (
      item."id" = 'home'
      AND item."value" = '/'
      AND page."type" = 'PAGE'
      AND page."layout" = 'HOME'
    )
    OR
    (
      item."id" = 'posts'
      AND item."value" = '/posts'
      AND page."type" = 'PAGE'
      AND page."layout" = 'POSTS'
      AND page."id" = (
        SELECT MIN(candidate."id")
        FROM "Page" AS candidate
        WHERE candidate."type" = 'PAGE'
          AND candidate."layout" = 'POSTS'
        HAVING COUNT(*) = 1
      )
    )
  );
