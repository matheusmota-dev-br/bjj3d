// The Storybook chrome in the project's colours: navy, the two fighters' amber and blue.
import { create } from "storybook/theming";

export default create({
  base: "dark",
  brandTitle: "bjj3d",
  brandUrl: "https://github.com/matheusmota-dev-br/bjj3d",
  brandImage: "./favicon.svg",
  colorPrimary: "#f2b544",
  colorSecondary: "#5fb4ff",
  appBg: "#111c2e",
  appContentBg: "#0e1726",
  appPreviewBg: "#0e1726",
  appBorderColor: "#26385a",
  appBorderRadius: 10,
  barBg: "#111c2e",
  barTextColor: "#93a6bd",
  barSelectedColor: "#f2b544",
  textColor: "#e8eef5",
  textMutedColor: "#93a6bd",
  inputBg: "#18253b",
  inputBorder: "#26385a",
  inputTextColor: "#e8eef5",
  fontBase: '"Source Sans 3", system-ui, sans-serif',
  fontCode: "ui-monospace, Menlo, monospace",
});
