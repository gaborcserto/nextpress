import config from "@nextpress/eslint-config/base";

const dbConfig = [
  {
    ignores: ["generated/**"]
  },
  ...config
];

export default dbConfig;
