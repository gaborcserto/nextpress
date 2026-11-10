import { checkStaged } from "./scripts/check-staged.mjs";

export default {
  "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,css,scss,json,jsonc,yml,yaml}": {
    title: "Check staged files",
    async task(files, { log }) {
      if (
        !(await checkStaged(files, {
          log,
          verbose: process.argv.includes("--debug"),
        }))
      ) {
        throw new Error(
          "Staged formatting, lint or readability checks failed.",
        );
      }
    },
  },
};
