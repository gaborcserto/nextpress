"use client";

import dynamic from "next/dynamic";

import "swagger-ui-react/swagger-ui.css";
import "./swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <p role="status">Loading API documentation…</p>,
});

export default function SwaggerDocs() {
  return (
    <section aria-label="Interactive API documentation" className="swagger-ui-surface mx-auto max-w-7xl">
      <SwaggerUI
        url="/api/openapi"
        docExpansion="list"
        displayRequestDuration
        queryConfigEnabled={false}
        supportedSubmitMethods={["get", "post", "put", "patch", "delete"]}
      />
    </section>
  );
}
