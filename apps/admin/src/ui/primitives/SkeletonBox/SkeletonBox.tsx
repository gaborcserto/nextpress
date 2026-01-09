"use client";

import { Box } from "../Box";

/**
 * Skeleton loader version of Card.
 * Useful while dashboard data is loading.
 */
export default function SkeletonBox() {
  return (
      <Box className="space-y-4">
        {/* Title skeleton */}
        <div className="skeleton h-10 w-2/3" />

        {/* Content lines */}
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
              <div
                  key={i}
                  className="skeleton h-4"
                  style={{ width: `${100 - i * 10}%` }}
              />
          ))}
        </div>
      </Box>
  );
}
