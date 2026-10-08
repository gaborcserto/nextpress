"use client";

import { useCallback, useEffect, useState } from "react";
import { FiActivity, FiClock, FiRefreshCw, FiServer } from "react-icons/fi";

type HealthDashboardProps = {
  environment: string;
  deployment: string;
};

type CheckState = "loading" | "available" | "unavailable";

function formatDate(value: number | null) {
  return value === null ? "Unknown" : new Date(value).toLocaleString();
}

export default function HealthDashboard({ environment, deployment }: HealthDashboardProps) {
  const [state, setState] = useState<CheckState>("loading");
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [lastSuccessfulCheck, setLastSuccessfulCheck] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setState("loading");
    setError(null);
    setResponseTime(null);
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const body: unknown = await response.json();
      const elapsed = Math.round(performance.now() - startedAt);
      if (!response.ok || typeof body !== "object" || body === null || !("status" in body) || body.status !== "ok") {
        throw new Error("Health check returned an unexpected response.");
      }

      const checkedAt = Date.now();
      setResponseTime(elapsed);
      setLastSuccessfulCheck(checkedAt);
      setState("available");
    } catch {
      setState("unavailable");
      setError("Could not reach the health endpoint. Try again.");
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const available = state === "available";

  return (
    <main className="min-h-screen bg-base-200 px-4 py-8 text-base-content sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/auth/sign-in" className="text-sm font-medium text-primary hover:underline">NextPress Admin</a>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">System health</h1>
            <p className="mt-2 max-w-xl text-base-content/70">A live view of this application&apos;s availability and runtime environment.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary min-h-11 self-start sm:self-auto"
            onClick={() => void checkHealth()}
            disabled={state === "loading"}
          >
            <FiRefreshCw aria-hidden="true" className={state === "loading" ? "animate-spin" : ""} />
            {state === "loading" ? "Checking…" : "Refresh"}
          </button>
        </header>

        {error ? <p role="alert" className="rounded-box border border-error/40 bg-error/10 p-4 text-error">{error}</p> : null}

        <section aria-label="Health metrics" className="grid gap-4 sm:grid-cols-2">
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div className="flex items-center gap-3 text-base-content/70"><FiActivity aria-hidden="true" /><h2 className="font-medium">API availability</h2></div>
              <p aria-live="polite" className="flex items-center gap-2 text-2xl font-semibold">
                {state === "loading" ? <span className="loading loading-spinner loading-sm" aria-label="Checking availability" /> : null}
                {state === "loading" ? "Checking" : available ? "Available" : "Unavailable"}
              </p>
              <p className="text-sm text-base-content/60">Public application liveness endpoint</p>
            </div>
          </article>

          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div className="flex items-center gap-3 text-base-content/70"><FiClock aria-hidden="true" /><h2 className="font-medium">Response time</h2></div>
              <p className="text-2xl font-semibold">{responseTime === null ? "Unknown" : `${responseTime} ms`}</p>
              <p className="text-sm text-base-content/60">Measured from this browser</p>
            </div>
          </article>

          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div className="flex items-center gap-3 text-base-content/70"><FiClock aria-hidden="true" /><h2 className="font-medium">Last successful check</h2></div>
              <p className="text-lg font-semibold">{formatDate(lastSuccessfulCheck)}</p>
              <p className="text-sm text-base-content/60">Updates when a check succeeds</p>
            </div>
          </article>

          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div className="flex items-center gap-3 text-base-content/70"><FiServer aria-hidden="true" /><h2 className="font-medium">Environment</h2></div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-base-content/60">Runtime</dt><dd className="font-medium">{environment}</dd>
                <dt className="text-base-content/60">Deployment</dt><dd className="font-medium">{deployment}</dd>
              </dl>
            </div>
          </article>
        </section>

        <p className="text-sm text-base-content/60">The liveness check confirms the application responds. It does not check database connectivity or operational readiness.</p>
      </div>
    </main>
  );
}
