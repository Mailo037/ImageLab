export type SettingsSection = "overview" | "appearance" | "processing" | "privacy" | "updates" | "about";

export type SettingsSectionDefinition = {
  id: SettingsSection;
  title: string;
  description: string;
  keywords: string[];
};

export type SettingDefinition = {
  id: string;
  section: Exclude<SettingsSection, "overview">;
  title: string;
  description: string;
  keywords: string[];
  aliases?: string[];
};

export const settingsSections: SettingsSectionDefinition[] = [
  { id: "overview", title: "Settings", description: "Choose a settings category.", keywords: ["preferences", "options"] },
  { id: "appearance", title: "Appearance", description: "Theme and interface density.", keywords: ["theme", "light", "dark", "system", "color mode"] },
  { id: "processing", title: "Processing", description: "Preview quality and memory use.", keywords: ["performance", "preview", "memory"] },
  { id: "privacy", title: "Privacy & local data", description: "Local storage and recent-session controls.", keywords: ["storage", "cache", "recent", "clear", "local"] },
  { id: "updates", title: "Updates", description: "Application version and update checks.", keywords: ["version", "release", "github", "upgrade"] },
  { id: "about", title: "About", description: "Project information and build details.", keywords: ["license", "source", "build", "version"] },
];

export const settingsRegistry: SettingDefinition[] = [
  { id: "appearance.theme", section: "appearance", title: "Theme", description: "Choose light, dark, or system appearance.", keywords: ["theme", "light", "dark", "system"], aliases: ["color mode", "night mode", "day mode", "appearance"] },
  { id: "appearance.density", section: "appearance", title: "Interface density", description: "Control the compactness of ImageLab controls.", keywords: ["density", "compact", "spacing"], aliases: ["layout", "ui density"] },
  { id: "processing.preview", section: "processing", title: "Preview quality", description: "Choose the resolution used while editing.", keywords: ["preview", "quality", "speed"], aliases: ["performance", "rendering"] },
  { id: "processing.memory", section: "processing", title: "Memory-conscious mode", description: "Use smaller previews for large images.", keywords: ["memory", "large images", "ram"], aliases: ["performance", "low memory"] },
  { id: "privacy.local", section: "privacy", title: "Local processing", description: "Normal image editing stays in this browser.", keywords: ["local", "privacy", "offline"], aliases: ["uploads", "image privacy"] },
  { id: "privacy.recents", section: "privacy", title: "Keep copies in Recent", description: "Keep local metadata for recent sessions.", keywords: ["recent", "history", "storage"], aliases: ["local data", "files"] },
  { id: "privacy.clear", section: "privacy", title: "Clear recent sessions", description: "Remove local recent-session metadata.", keywords: ["clear", "remove", "recent"], aliases: ["clear files", "clear cache", "delete history"] },
  { id: "updates.auto-check", section: "updates", title: "Automatically check for updates", description: "Look for a new stable ImageLab release occasionally.", keywords: ["updates", "automatic", "release"], aliases: ["auto update", "check updates"] },
  { id: "updates.check", section: "updates", title: "Check for updates", description: "Compare this version with the latest stable release.", keywords: ["updates", "check", "latest", "version"], aliases: ["update now", "new version"] },
  { id: "about.version", section: "about", title: "Version and build information", description: "View the running version, commit, and build time.", keywords: ["version", "build", "commit"], aliases: ["about", "diagnostics"] },
  { id: "about.source", section: "about", title: "View source", description: "Open the public ImageLab source repository.", keywords: ["github", "source", "open source"], aliases: ["repository", "license"] },
];

export const getSettingsSection = (section: string | null | undefined) => settingsSections.find((item) => item.id === section) ?? settingsSections[0];
export const isSettingsSection = (section: string | null | undefined): section is SettingsSection => Boolean(settingsSections.find((item) => item.id === section));

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const fuzzy = (query: string, value: string) => {
  let position = 0;
  for (const character of query) {
    position = value.indexOf(character, position);
    if (position < 0) return false;
    position += 1;
  }
  return true;
};

const scoreSetting = (query: string, setting: SettingDefinition) => {
  const title = normalize(setting.title);
  const section = normalize(getSettingsSection(setting.section).title);
  const values = [title, section, normalize(setting.description), ...setting.keywords.map(normalize), ...(setting.aliases ?? []).map(normalize)];
  if (title === query) return 1000;
  if (title.startsWith(query)) return 900 - title.length;
  const direct = values.findIndex((value) => value.includes(query));
  if (direct >= 0) return 780 - direct * 20 - values[direct].indexOf(query);
  const fuzzyIndex = values.findIndex((value) => fuzzy(query.replace(/\s/g, ""), value.replace(/\s/g, "")));
  return fuzzyIndex >= 0 ? 500 - fuzzyIndex * 20 : -1;
};

export const searchSettings = (query: string) => {
  const normalized = normalize(query);
  if (!normalized) return [];
  return settingsRegistry
    .map((setting) => ({ setting, score: scoreSetting(normalized, setting) }))
    .filter((result) => result.score >= 0)
    .sort((left, right) => right.score - left.score || left.setting.title.localeCompare(right.setting.title))
    .map((result) => result.setting);
};
