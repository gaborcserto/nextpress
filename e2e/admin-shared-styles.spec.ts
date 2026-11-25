import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://localhost:49201" },
    data: {
      email: "admin@example.invalid",
      password: "Disposable browser passphrase 2026",
    },
  });

  expect(response.status()).toBe(200);
}

test("Admin shared styles render at desktop and mobile widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Content statistics" }),
  ).toBeVisible();

  const desktopDashboard = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(
      ".admin-dashboard-metrics",
    );
    const card = document.querySelector<HTMLElement>(".admin-dashboard-stat");

    if (!grid || !card) {
      throw new Error("Dashboard statistics did not render");
    }

    const cardStyle = getComputedStyle(card);

    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      background: cardStyle.backgroundColor,
      border: cardStyle.borderTopWidth,
      padding: cardStyle.padding,
    };
  });

  expect(desktopDashboard.columns).toBe(4);
  expect(desktopDashboard.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(desktopDashboard.border).toBe("1px");
  expect(desktopDashboard.padding).not.toBe("0px");

  const semanticStyles = await page.evaluate(() => {
    const statuses = ["PUBLISHED", "DRAFT", "SCHEDULED"].map((status) => {
      const badge = document.createElement("span");
      badge.className = "admin-badge";
      badge.dataset.publicationState = status;
      document.body.append(badge);

      return getComputedStyle(badge).backgroundColor;
    });
    const systemBadge = document.createElement("span");
    systemBadge.className = "admin-badge admin-badge-info";
    document.body.append(systemBadge);

    const rowList = document.createElement("ul");
    rowList.className = "admin-overview-list";
    rowList.innerHTML =
      '<li><a class="admin-overview-row" href="#">Recent</a></li>';
    document.body.append(rowList);

    const busyButton = document.createElement("button");
    busyButton.className = "admin-button";
    busyButton.setAttribute("aria-busy", "true");
    busyButton.innerHTML =
      '<span class="admin-button-content"><span class="admin-button-content-state" id="normal">Normal</span><span class="admin-button-content-state admin-button-loading-content" id="loading">Loading</span></span>';
    document.body.append(busyButton);
    const normal = busyButton.querySelector("#normal");
    const loading = busyButton.querySelector("#loading");

    if (!normal || !loading) {
      throw new Error("Button content states did not render");
    }

    const busyWidth = busyButton.getBoundingClientRect().width;
    const normalVisibility = getComputedStyle(normal).visibility;
    const loadingVisibility = getComputedStyle(loading).visibility;
    busyButton.removeAttribute("aria-busy");

    return {
      statuses,
      system: getComputedStyle(systemBadge).backgroundColor,
      normalVisibility,
      loadingVisibility,
      idleNormalVisibility: getComputedStyle(normal).visibility,
      idleLoadingVisibility: getComputedStyle(loading).visibility,
      busyWidth,
      idleWidth: busyButton.getBoundingClientRect().width,
    };
  });

  expect(new Set(semanticStyles.statuses).size).toBe(3);
  expect(semanticStyles.statuses).not.toContain(semanticStyles.system);
  expect(semanticStyles.normalVisibility).toBe("hidden");
  expect(semanticStyles.loadingVisibility).toBe("visible");
  expect(semanticStyles.idleNormalVisibility).toBe("visible");
  expect(semanticStyles.idleLoadingVisibility).toBe("hidden");
  expect(semanticStyles.idleWidth).toBe(semanticStyles.busyWidth);

  const recentRow = page
    .locator(".admin-overview-list .admin-overview-row")
    .first();
  await recentRow.hover();
  const hoverBackground = await recentRow.evaluate(
    (row) => getComputedStyle(row).backgroundColor,
  );
  expect(hoverBackground).not.toBe("rgba(0, 0, 0, 0)");

  await page.goto("/admin/posts");
  const desktopToolbar = page.locator(".admin-list-toolbar");
  const search = page.getByRole("searchbox", { name: "Search" });
  await expect(desktopToolbar).toBeVisible();
  expect(
    await search.evaluate((input) => input.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(240);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  const mobileColumns = await page
    .locator(".admin-dashboard-metrics")
    .evaluate(
      (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
    );
  expect(mobileColumns).toBe(2);

  await page.goto("/admin/posts");
  const mobileToolbar = page.locator(".admin-list-toolbar");
  await expect(mobileToolbar).toBeVisible();
  expect(
    await mobileToolbar.evaluate(
      (form) => getComputedStyle(form).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(1);
  const mobileSort = page.locator(".admin-mobile-sort");
  await expect(mobileSort).toBeVisible();
  const sortGeometry = await mobileSort.evaluate((container) => {
    const select = container.querySelector(".select");
    const button = container.querySelector("button");

    if (!select || !button) {
      throw new Error("Mobile sort controls did not render");
    }

    return {
      selectTop: select.getBoundingClientRect().top,
      buttonTop: button.getBoundingClientRect().top,
      buttonLeft: button.getBoundingClientRect().left,
    };
  });
  expect(
    Math.abs(sortGeometry.selectTop - sortGeometry.buttonTop),
  ).toBeLessThan(2);
  expect(sortGeometry.buttonLeft).toBeGreaterThan(250);
});
