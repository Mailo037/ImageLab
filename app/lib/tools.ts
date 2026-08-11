export type Category = "Optimize" | "Resize & Crop" | "Convert" | "Effects" | "Color" | "Transparency" | "Privacy" | "Creative" | "Inspect";
export type Mode = "compress" | "resize" | "crop" | "rotate" | "padding" | "effect" | "color" | "transparent" | "privacy" | "text" | "shape" | "palette" | "metadata" | "grid" | "favicon";

export type Tool = {
  id: string;
  name: string;
  description: string;
  category: Category;
  icon: string;
  mode: Mode;
  effect?: string;
  supportsBatch: boolean;
  supportsPreview: boolean;
  route: string;
  supportedInputFormats: string[];
  supportedOutputFormats: string[];
  settings: string[];
  processor: "canvas" | "palette" | "metadata" | "composition";
  worker: boolean;
  keyboardShortcut?: string;
};

const inputs = ["PNG", "JPEG", "WebP", "AVIF", "GIF", "BMP", "ICO", "SVG"];
const outputs = ["PNG", "JPEG", "WebP", "AVIF", "BMP", "ICO"];
const tool = (value: Omit<Tool, "route" | "supportedInputFormats" | "supportedOutputFormats">): Tool => ({
  ...value,
  route: `/tools/${value.id}`,
  supportedInputFormats: inputs,
  supportedOutputFormats: outputs,
});

export const tools: Tool[] = [
  tool({ id: "compress", name: "Compress Image", description: "Reduce file size with quality and target-size controls.", category: "Optimize", icon: "compress", mode: "compress", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: true, settings: ["quality", "target size", "format"], keyboardShortcut: "C" }),
  tool({ id: "web", name: "Optimize for Web", description: "Create a sharp, compact web-ready output.", category: "Optimize", icon: "spark", mode: "compress", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: true, settings: ["quality", "format"], effect: "web" }),
  tool({ id: "strip", name: "Strip Metadata", description: "Export a clean copy without embedded EXIF or GPS.", category: "Optimize", icon: "shield", mode: "compress", supportsBatch: true, supportsPreview: false, processor: "canvas", worker: true, settings: ["format"] }),
  tool({ id: "resize", name: "Resize Image", description: "Change exact output dimensions locally.", category: "Resize & Crop", icon: "resize", mode: "resize", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: true, settings: ["width", "height", "aspect ratio"], keyboardShortcut: "R" }),
  tool({ id: "crop", name: "Crop", description: "Frame the image using adaptable aspect presets.", category: "Resize & Crop", icon: "crop", mode: "crop", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["aspect", "position", "zoom"] }),
  tool({ id: "rotate", name: "Rotate & Flip", description: "Turn, mirror, or flip an image.", category: "Resize & Crop", icon: "rotate", mode: "rotate", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: true, settings: ["rotation", "flip"] }),
  tool({ id: "padding", name: "Extend Canvas", description: "Add transparent or colored canvas space.", category: "Resize & Crop", icon: "frame", mode: "padding", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: true, settings: ["padding", "color"] }),
  tool({ id: "thumbnail", name: "Thumbnail Generator", description: "Apply practical platform dimensions.", category: "Resize & Crop", icon: "thumb", mode: "resize", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: true, settings: ["platform preset"] }),
  tool({ id: "convert", name: "Convert Image", description: "Convert using browser-native image encoders.", category: "Convert", icon: "convert", mode: "compress", supportsBatch: true, supportsPreview: false, processor: "canvas", worker: true, settings: ["format", "quality"], keyboardShortcut: "V" }),
  tool({ id: "pixelate", name: "Pixelate", description: "Build clean adjustable pixel blocks.", category: "Effects", icon: "pixel", mode: "effect", effect: "pixelate", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["pixel size"], keyboardShortcut: "P" }),
  tool({ id: "blur", name: "Blur", description: "Apply smooth local browser blur.", category: "Effects", icon: "blur", mode: "effect", effect: "blur", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["radius"] }),
  tool({ id: "sharpen", name: "Sharpen", description: "Restore crisp edge definition.", category: "Effects", icon: "focus", mode: "effect", effect: "sharpen", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["strength"] }),
  tool({ id: "grayscale", name: "Grayscale", description: "Balanced monochrome conversion.", category: "Effects", icon: "mono", mode: "effect", effect: "grayscale", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: [] }),
  tool({ id: "sepia", name: "Sepia", description: "Warm archival image treatment.", category: "Effects", icon: "tone", mode: "effect", effect: "sepia", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["amount"] }),
  tool({ id: "invert", name: "Invert", description: "Invert colors non-destructively.", category: "Effects", icon: "invert", mode: "effect", effect: "invert", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: [] }),
  tool({ id: "posterize", name: "Posterize", description: "Compress tones into graphic bands.", category: "Effects", icon: "layers", mode: "effect", effect: "posterize", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["levels"] }),
  tool({ id: "grain", name: "Film Grain", description: "Add controlled analog texture.", category: "Effects", icon: "grain", mode: "effect", effect: "grain", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["amount"] }),
  tool({ id: "vignette", name: "Vignette", description: "Focus attention toward the center.", category: "Effects", icon: "vignette", mode: "effect", effect: "vignette", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["amount"] }),
  tool({ id: "threshold", name: "Threshold", description: "Create a high-contrast monochrome effect.", category: "Effects", icon: "threshold", mode: "effect", effect: "threshold", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["threshold"] }),
  tool({ id: "duotone", name: "Duotone", description: "Map tones to two chosen colors.", category: "Effects", icon: "duotone", mode: "effect", effect: "duotone", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["colors"] }),
  tool({ id: "scanlines", name: "Scanlines", description: "Add compact display texture.", category: "Effects", icon: "scan", mode: "effect", effect: "scanlines", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["amount"] }),
  tool({ id: "color", name: "Color Adjustments", description: "Tune light, color, and RGB channels.", category: "Color", icon: "sliders", mode: "color", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["brightness", "contrast", "saturation"], keyboardShortcut: "A" }),
  tool({ id: "palette", name: "Color Palette", description: "Extract dominant local image colors.", category: "Color", icon: "palette", mode: "palette", supportsBatch: false, supportsPreview: false, processor: "palette", worker: false, settings: ["color count"] }),
  tool({ id: "remove-bg", name: "Remove Background", description: "Make a detected edge color transparent.", category: "Transparency", icon: "erase", mode: "transparent", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["tolerance"] }),
  tool({ id: "transparent", name: "Make Color Transparent", description: "Key out a chosen color locally.", category: "Transparency", icon: "drop", mode: "transparent", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["color", "tolerance"] }),
  tool({ id: "background", name: "Replace Background", description: "Place a solid local backdrop behind transparency.", category: "Transparency", icon: "paint", mode: "transparent", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["color"] }),
  tool({ id: "trim", name: "Trim Transparent Pixels", description: "Remove unused transparent margins.", category: "Transparency", icon: "trim", mode: "transparent", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: [] }),
  tool({ id: "blur-selection", name: "Blur Selected Area", description: "Draw movable blur regions directly on canvas.", category: "Privacy", icon: "mask", mode: "privacy", effect: "blur", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["masks", "radius"] }),
  tool({ id: "pixelate-selection", name: "Pixelate Selected Area", description: "Pixelate selected sensitive regions.", category: "Privacy", icon: "mask", mode: "privacy", effect: "pixelate", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["masks", "pixel size"] }),
  tool({ id: "redact", name: "Redact Area", description: "Cover selected private information.", category: "Privacy", icon: "redact", mode: "privacy", effect: "redact", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["masks", "color"] }),
  tool({ id: "text", name: "Add Text", description: "Place typography on your image.", category: "Creative", icon: "text", mode: "text", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["text", "color", "size"] }),
  tool({ id: "watermark", name: "Watermark", description: "Add a restrained text watermark.", category: "Creative", icon: "watermark", mode: "text", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["text", "opacity"] }),
  tool({ id: "corners", name: "Rounded Corners", description: "Round output corners with transparency.", category: "Creative", icon: "corner", mode: "shape", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["radius"] }),
  tool({ id: "border", name: "Add Border", description: "Frame an image with a clean edge.", category: "Creative", icon: "border", mode: "shape", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["width", "color"] }),
  tool({ id: "shadow", name: "Add Shadow", description: "Create a subtle depth treatment.", category: "Creative", icon: "shadow", mode: "shape", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["blur", "opacity"] }),
  tool({ id: "mirror", name: "Mirror Effect", description: "Mirror your image around a vertical seam.", category: "Creative", icon: "mirror", mode: "effect", effect: "mirror", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: [] }),
  tool({ id: "reflection", name: "Reflection", description: "Add a fading reflection below the source.", category: "Creative", icon: "reflection", mode: "effect", effect: "reflection", supportsBatch: true, supportsPreview: true, processor: "canvas", worker: false, settings: ["amount"] }),
  tool({ id: "grid", name: "Image Grid", description: "Build a local contact sheet from selected images.", category: "Creative", icon: "grid", mode: "grid", supportsBatch: false, supportsPreview: true, processor: "composition", worker: false, settings: ["columns", "gap"] }),
  tool({ id: "favicon", name: "Favicon Generator", description: "Export browser-ready PNG and ICO icons.", category: "Creative", icon: "app", mode: "favicon", supportsBatch: false, supportsPreview: true, processor: "canvas", worker: true, settings: ["size", "format"] }),
  tool({ id: "metadata", name: "Image Inspector", description: "Inspect image dimensions and embedded metadata.", category: "Inspect", icon: "info", mode: "metadata", supportsBatch: false, supportsPreview: false, processor: "metadata", worker: false, settings: [], keyboardShortcut: "I" }),
];

export const categories: Array<Category | "All Tools" | "Favorites" | "Recent"> = ["All Tools", "Favorites", "Recent", "Optimize", "Resize & Crop", "Convert", "Effects", "Color", "Transparency", "Privacy", "Creative", "Inspect"];
export const getTool = (id?: string | null) => tools.find((item) => item.id === id) ?? tools[0];
export const fuzzy = (query: string, value: string) => {
  const q = query.trim().toLowerCase();
  const v = value.toLowerCase();
  if (!q) return true;
  let position = 0;
  for (const character of q) {
    position = v.indexOf(character, position);
    if (position < 0) return false;
    position += 1;
  }
  return true;
};
