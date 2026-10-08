type SwaggerUIBundleOptions = {
  domNode: HTMLElement;
  url: string;
  docExpansion: "list";
  displayRequestDuration: boolean;
  queryConfigEnabled: boolean;
  supportedSubmitMethods: string[];
  validatorUrl: null;
  withCredentials?: boolean;
};

declare global {
  interface Window {
    SwaggerUIBundle?: (options: SwaggerUIBundleOptions) => unknown;
  }
}

export {};
