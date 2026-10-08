import { headers } from "next/headers";
import { notFound } from "next/navigation";

import "./swagger-ui.css";

import SwaggerUiLoader from "./swagger-ui-loader";

export const dynamic = "force-dynamic";

export default async function ApiDocsPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const requestHeaders = await headers();
  const nonce = requestHeaders.get("Content-Security-Policy")
    ?.match(/'nonce-([^']+)'/)?.[1];

  return (
    <main className="api-docs min-h-screen min-w-0 px-3 py-6 sm:px-6">
      <header className="mx-auto mb-6 max-w-7xl space-y-3">
        <h1 className="text-3xl font-bold">NextPress API</h1>
        <p>
          Development documentation. Sign in through the admin application to make authenticated requests.
        </p>
        <p role="alert" className="rounded border border-warning bg-warning/20 p-4 font-semibold">
          Try it out and Execute send requests as your signed-in user. Write requests can modify real data and remain subject to the API&apos;s normal authorization and security checks.
        </p>
        <a className="link" href="/api/openapi">View OpenAPI JSON</a>
      </header>
      <section aria-label="Interactive API documentation" className="swagger-ui-surface mx-auto max-w-7xl">
        <div id="swagger-ui" />
      </section>
      <SwaggerUiLoader nonce={nonce} />
    </main>
  );
}
