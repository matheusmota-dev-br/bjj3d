// Every story: the site's fonts and colour tokens, and toolbar globals (theme, place, look)
// that the 3D stories apply to their viewer.
import type { Preview } from "@storybook/html-vite";
import "@bjj3d/ui/tokens.css";
import "@bjj3d/ui/ui.css";
import "./preview.css";
import theme from "./theme.ts";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    docs: { theme },
    options: {
      storySort: { order: ["Introduction", "Guides", "Foundations", "Atoms", "Molecules", "Organisms", "Templates", "Pages", "Engine"] },
    },
  },
  globalTypes: {
    theme: {
      description: "Light or dark",
      toolbar: { title: "Theme", icon: "mirror", items: ["dark", "light"], dynamicTitle: true },
    },
    place: {
      description: "Where the fighters are",
      toolbar: { title: "Place", icon: "globe", items: ["mat", "gym", "studio", "night"], dynamicTitle: true },
    },
    look: {
      description: "How the mannequins look",
      toolbar: { title: "Look", icon: "paintbrush", items: ["solid", "wood", "hologram"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "dark", place: "mat", look: "solid" },
  decorators: [
    (story, context) => {
      document.documentElement.dataset.theme = context.globals.theme;
      // The site's page states (panel open, fighters screen) never leak from one story to the next.
      document.body.classList.remove("open", "studio");
      return story();
    },
  ],
};

export default preview;
