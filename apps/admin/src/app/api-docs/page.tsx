import { notFound } from "next/navigation";

import { openApiDocument } from "@/lib/api/openapi";

export const dynamic = "force-dynamic";

const methods = ["get", "post", "put", "patch", "delete"] as const;

export default function ApiDocsPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">NextPress API</h1>
        <p>Development reference. Requests cannot be executed here. Sign in through the admin application.</p>
        <p>{openApiDocument.info.description}</p>
        <a className="link" href="/api/openapi">View OpenAPI JSON</a>
      </header>
      <nav aria-label="API groups" className="flex flex-wrap gap-4">
        {openApiDocument.tags?.map(({ name }) => <a className="link" href={`#${name}`} key={name}>{name}</a>)}
        <a className="link" href="#schemas">Schemas</a>
      </nav>
      {openApiDocument.tags?.map(({ name }) => (
        <section key={name} id={name} className="space-y-4">
          <h2 className="text-2xl font-semibold">{name}</h2>
          {Object.entries(openApiDocument.paths ?? {}).flatMap(([path, item]) => methods.map((method) => {
            const operation = item?.[method];
            if (!operation?.tags?.includes(name)) return null;
            return (
              <details key={`${method}-${path}`} className="rounded border p-4">
                <summary className="cursor-pointer">{method.toUpperCase()} {path} — {operation.summary}</summary>
                <div className="mt-4 space-y-4">
                  <p>{operation.description}</p>
                  <p>Authentication: {operation.security?.some((entry) => Object.keys(entry).length === 0) ? "Optional session" : operation.security?.length ? "Session cookie required" : "Public"}.</p>
                  {(item?.parameters?.length || operation.parameters?.length) ? (
                    <div>
                      <h3 className="font-semibold">Parameters</h3>
                      <pre className="overflow-auto rounded bg-base-200 p-4 text-sm">{JSON.stringify([...(item?.parameters ?? []), ...(operation.parameters ?? [])], null, 2)}</pre>
                    </div>
                  ) : null}
                  {operation.requestBody ? (
                    <div>
                      <h3 className="font-semibold">Request body</h3>
                      <pre className="overflow-auto rounded bg-base-200 p-4 text-sm">{JSON.stringify(operation.requestBody, null, 2)}</pre>
                    </div>
                  ) : null}
                  <div className="overflow-auto">
                    <table className="table">
                      <caption className="text-left font-semibold">Responses</caption>
                      <thead><tr><th scope="col">Status</th><th scope="col">Meaning and schema</th></tr></thead>
                      <tbody>
                        {Object.entries(operation.responses).map(([code, response]) => (
                          <tr key={code}>
                            <th scope="row">{code}</th>
                            <td>
                              {"$ref" in response ? <code>{response.$ref}</code> : (
                                <>
                                  <p>{response.description}</p>
                                  {response.content ? <pre className="overflow-auto text-sm">{JSON.stringify(response.content, null, 2)}</pre> : null}
                                  {response.headers ? <pre className="overflow-auto text-sm">{JSON.stringify(response.headers, null, 2)}</pre> : null}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            );
          }))}
        </section>
      ))}
      <section id="schemas" className="space-y-4">
        <h2 className="text-2xl font-semibold">Schemas</h2>
        {Object.entries(openApiDocument.components?.schemas ?? {}).map(([name, value]) => (
          <details key={name} id={`schema-${name}`} className="rounded border p-4">
            <summary className="cursor-pointer">{name}</summary>
            <pre className="mt-4 overflow-auto text-sm">{JSON.stringify(value, null, 2)}</pre>
          </details>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Session authentication</h2>
        <pre className="overflow-auto text-sm">{JSON.stringify(openApiDocument.components?.securitySchemes, null, 2)}</pre>
      </section>
    </main>
  );
}
