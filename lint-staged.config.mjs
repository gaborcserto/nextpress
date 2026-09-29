const normalizePath = (file) => file.replaceAll("\\", "/");

export default {
  "*.{js,jsx,ts,tsx}": (files) => {
    const normalizedFiles = files.map(normalizePath);
    const commands = [];

    const adminFiles = normalizedFiles.filter((file) => file.includes("/apps/admin/"));
    if (adminFiles.length > 0) {
      commands.push(
        `eslint --config apps/admin/eslint.config.mjs --no-warn-ignored ${adminFiles.join(" ")}`
      );
    }

    const webFiles = normalizedFiles.filter((file) => file.includes("/apps/web/"));
    if (webFiles.length > 0) {
      commands.push(
        `eslint --config apps/web/eslint.config.mjs --no-warn-ignored ${webFiles.join(" ")}`
      );
    }

    const dbFiles = normalizedFiles.filter((file) => file.includes("/packages/db/"));
    if (dbFiles.length > 0) {
      commands.push(
        `eslint --config packages/db/eslint.config.mjs --no-warn-ignored ${dbFiles.join(" ")}`
      );
    }

    const configuredFiles = new Set([...adminFiles, ...webFiles, ...dbFiles]);
    const otherFiles = normalizedFiles.filter((file) => !configuredFiles.has(file));
    if (otherFiles.length > 0) {
      commands.push(`eslint --no-warn-ignored ${otherFiles.join(" ")}`);
    }

    return commands;
  }
};
