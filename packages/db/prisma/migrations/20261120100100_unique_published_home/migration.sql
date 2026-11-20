-- Published or scheduled HOME pages reserve the single site-wide slot.
CREATE UNIQUE INDEX "Page_published_home_key" ON "Page" ("layout")
WHERE "type" = 'PAGE' AND "layout" = 'HOME' AND "status" = 'PUBLISHED';
