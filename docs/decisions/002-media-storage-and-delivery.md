# ADR-002: API-owned media storage and delivery

- Status: Accepted

Uploads reuse the API's existing PNG storage keys and deployment configuration. The database stores the stable asset identity, display metadata, ownership, and content relationships. Admin and Web use HTTP URLs and media IDs. A replacement object-store implementation can adopt the existing storage operations once the deployment topology is known.

Writes use exclusive filenames. Failed writes remove partial files when possible. A failed metadata insert checks for a committed row before removing its file. An inconclusive check preserves the file for reconciliation. Deletion commits the metadata change before removing bytes. A failed or interrupted cleanup can leave private bytes behind, and storage and PostgreSQL have independent commit boundaries. Cleanup failures emit `media.cleanup_failed`. Preserve the database and media root together and reconcile suspected orphans offline.

Assigning legacy cover, gallery, and structured document references and deleting a media row share the revision advisory lock. Restrictive PostgreSQL relations also protect cover, gallery, retained editorial revisions, and private working snapshots. Legacy text references are checked conservatively. The resulting conflict never returns document titles, draft identities, or revision details.

Public Web delegates media eligibility to the API and serves eligible files with no-store caching. Unpublished-only uploads require a permitted Admin session. Live Preview requests only the media referenced by the snapshot received from the editor. Admin retrieves the bytes under the current session and returns them through the verified preview window, origin, and session channel. The preview draws them in its document without changing Web's image-source policy.
