"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    SwaggerUIBundle?: ((config: Record<string, unknown>) => unknown) & {
      presets: {
        apis: unknown;
      };
    };
    SwaggerUIStandalonePreset?: unknown;
  }
}

export function SwaggerUi() {
  const [bundleReady, setBundleReady] = useState(false);
  const [presetReady, setPresetReady] = useState(false);

  useEffect(() => {
    if (!bundleReady || !presetReady || !window.SwaggerUIBundle) {
      return;
    }

    window.SwaggerUIBundle({
      url: "/api/openapi",
      dom_id: "#swagger-ui",
      presets: [window.SwaggerUIBundle.presets.apis, window.SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
    });
  }, [bundleReady, presetReady]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => setBundleReady(true)}
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
        onLoad={() => setPresetReady(true)}
      />
      <div id="swagger-ui" className="min-h-screen" />
    </>
  );
}
