import config from "@nextpress/eslint-config/next";

const dbConfig = [
  {
    ignores: ["generated/**"]
  },
  ...config
];

export default dbConfig;
