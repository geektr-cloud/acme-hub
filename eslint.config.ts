import { acruxEslintConfig } from "@acrux/eslint-config";

export default acruxEslintConfig({
  ignores: ["src/components/ui/**", "server/generated/**", "src/assets/main.css"],
});
