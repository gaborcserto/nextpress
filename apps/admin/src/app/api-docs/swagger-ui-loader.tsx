"use client";

import Script from "next/script";

export default function SwaggerUiLoader({ nonce }: { nonce: string | undefined }) {
  return (
    <Script
      src="/api-docs/swagger-ui-bundle.js"
      strategy="afterInteractive"
      nonce={nonce}
      onReady={() => {
        const mount = document.getElementById("swagger-ui");
        if (
          !mount ||
          mount.dataset.swaggerMounted === "true" ||
          mount.dataset.swaggerLoading === "true" ||
          !window.SwaggerUIBundle
        ) return;

        mount.dataset.swaggerLoading = "true";
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "/api-docs/swagger-ui.css";
        stylesheet.addEventListener("load", () => {
          mount.dataset.swaggerMounted = "true";
          delete mount.dataset.swaggerLoading;
          document.documentElement.classList.toggle("dark-mode", document.documentElement.dataset.theme === "dark");
          window.SwaggerUIBundle?.({
            domNode: mount,
            url: "/api/openapi",
            docExpansion: "list",
            displayRequestDuration: true,
            queryConfigEnabled: false,
            supportedSubmitMethods: ["get", "post", "put", "patch", "delete"],
            validatorUrl: null,
          });
        }, { once: true });
        stylesheet.addEventListener("error", () => {
          delete mount.dataset.swaggerLoading;
          const message = document.createElement("p");
          message.setAttribute("role", "alert");
          message.textContent = "API documentation styles could not be loaded.";
          mount.replaceChildren(message);
        }, { once: true });
        document.head.append(stylesheet);
      }}
    />
  );
}
