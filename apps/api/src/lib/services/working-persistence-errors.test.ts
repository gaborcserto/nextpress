import { expect, it } from "vitest";

import { workingPersistenceFailure } from "./working-persistence-errors";

it("recognizes the singleton Homepage database constraint as a domain conflict", () => {
  expect(
    workingPersistenceFailure({
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: {
            constraint: { index: "Page_homepage_singleton_key" },
          },
        },
      },
    }),
  ).toBe("HOMEPAGE_CONFLICT");
});
