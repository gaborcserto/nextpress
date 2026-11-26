import Link from "next/link";

import type { IconType } from "react-icons";

type StatisticTone = "blue" | "purple" | "neutral" | "warning";

type DashboardStatisticCardProps = {
  title: string;
  Icon: IconType;
  tone: StatisticTone;
  primaryValue: string;
  primaryHref?: string;
  secondary?: {
    label: string;
    value: string;
    href: string;
  };
};

export function DashboardStatisticCard({
  title,
  Icon,
  tone,
  primaryValue,
  primaryHref,
  secondary,
}: DashboardStatisticCardProps) {
  return (
    <article className={`admin-dashboard-stat admin-dashboard-stat--${tone}`}>
      <div className="admin-dashboard-stat-header">
        <h3 className="admin-dashboard-stat-heading">
          <Icon aria-hidden="true" />
          {title}
        </h3>
        {primaryHref ? (
          <Link
            className="admin-dashboard-stat-primary-link admin-dashboard-stat-value"
            href={primaryHref}
            aria-label={`${title}: ${primaryValue}`}
          >
            {primaryValue}
          </Link>
        ) : (
          <span className="admin-dashboard-stat-value">{primaryValue}</span>
        )}
      </div>
      {secondary && (
        <Link
          className="admin-dashboard-stat-secondary"
          href={secondary.href}
          aria-label={`${title}: ${secondary.label} ${secondary.value}`}
        >
          <span>{secondary.label}</span>
          <span className="admin-dashboard-stat-secondary-value">
            {secondary.value}
          </span>
        </Link>
      )}
    </article>
  );
}
