/**
 * Build metadata is injected by Vite from package.json at build time.
 * package.json is the single canonical source for ImageLab's semantic version.
 */
declare const __IMAGELAB_VERSION__: string;
declare const __IMAGELAB_BUILD_SHA__: string;
declare const __IMAGELAB_BUILD_TIME__: string;

export const APP_VERSION = __IMAGELAB_VERSION__;
export const APP_BUILD = {
  version: APP_VERSION,
  commit: __IMAGELAB_BUILD_SHA__,
  builtAt: __IMAGELAB_BUILD_TIME__,
} as const;

export const APP_REPOSITORY_URL = "https://github.com/Mailo037/ImageLab";
export const APP_RELEASES_API_URL = "https://api.github.com/repos/Mailo037/ImageLab/releases/latest";

