import HealthDashboard from "./HealthDashboard";

export const metadata = { title: "Health | NextPress Admin" };

const environments = ["development", "production", "test"] as const;

function safeValue(value: string | undefined, allowed: readonly string[]) {
  return value && allowed.some((candidate) => candidate === value) ? value : "Unknown";
}

export default function HealthPage() {
  return (
    <HealthDashboard
      environment={safeValue(process.env.NODE_ENV, environments)}
      deployment="Unknown"
    />
  );
}
