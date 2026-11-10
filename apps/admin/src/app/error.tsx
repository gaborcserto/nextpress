"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen grid place-content-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Unable to load the administration</h1>
      <p role="alert">
        The service may be unavailable. Please try again shortly.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
