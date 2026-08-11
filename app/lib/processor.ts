export type Format = "PNG" | "JPEG" | "WebP" | "AVIF" | "BMP" | "ICO";
export type Point = { x: number; y: number };
export type Mask = { id: string; kind: "blur" | "pixelate" | "redact"; x: number; y: number; width: number; height: number; points?: Point[] };

export type Config = {
  toolId: string;
  format: Format;
  quality: number;
  targetKB: number | null;
  width: number | null;
  height: number | null;
  lockAspect: boolean;
  aspect: "free" | "1:1" | "4:3" | "3:2" | "16:9" | "9:16" | "21:9";
  cropZoom: number;
  cropX: number;
  cropY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  padding: number;
  paddingColor: string;
  effect: string | null;
  amount: number;
  pixelSize: number;
  blur: number;
  sharpen: number;
  posterize: number;
  threshold: number;
  dark: string;
  light: string;
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  temperature: number;
  hue: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
  keyColor: string;
  tolerance: number;
  removeBackground: boolean;
  background: string;
  trim: boolean;
  masks: Mask[];
  text: string;
  textColor: string;
  textSize: number;
  textOpacity: number;
  textX: number;
  textY: number;
  radius: number;
  borderWidth: number;
  borderColor: string;
  shadowBlur: number;
  shadowOpacity: number;
  shadowOffset: number;
  gridColumns: number;
  gridGap: number;
  iconSize: number;
};

/**
 * A configured, non-destructive edit. The editor owns the order and history,
 * while the renderer only needs the immutable settings for each stage.
 */
export type ImageOperation = {
  instanceId: string;
  toolId: string;
  enabled: boolean;
  order: number;
  config: Config;
};

export const defaultConfig: Config = {
  toolId: "compress", format: "WebP", quality: 82, targetKB: null, width: null, height: null, lockAspect: true,
  aspect: "free", cropZoom: 1, cropX: .5, cropY: .5, rotation: 0, flipX: false, flipY: false, padding: 0, paddingColor: "#ffffff",
  effect: null, amount: 35, pixelSize: 12, blur: 4, sharpen: .45, posterize: 5, threshold: 128, dark: "#19233f", light: "#bfe9dc",
  brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, hue: 0, red: 0, green: 0, blue: 0, alpha: 100,
  keyColor: "#ffffff", tolerance: 22, removeBackground: false, background: "#ffffff", trim: false, masks: [],
  text: "", textColor: "#ffffff", textSize: 48, textOpacity: 92, textX: .5, textY: .9,
  radius: 26, borderWidth: 8, borderColor: "#ffffff", shadowBlur: 18, shadowOpacity: 30, shadowOffset: 8,
  gridColumns: 2, gridGap: 16, iconSize: 64,
};

export const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const context = (surface: HTMLCanvasElement) => {
  const ctx = surface.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  return ctx;
};
const surface = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};
export type DecodedImage = ImageBitmap | HTMLImageElement;
export type RenderSource = Blob | DecodedImage | HTMLCanvasElement;
const dimensionsOf = (image: DecodedImage | HTMLCanvasElement) => "naturalWidth" in image ? { width: image.naturalWidth, height: image.naturalHeight } : { width: image.width, height: image.height };
export const releaseImage = (image: DecodedImage) => { if ("close" in image) image.close(); };
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  try { return await createImageBitmap(file); }
  catch {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not decode this image."));
        image.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }
}
export async function imageDimensions(file: Blob) { const image = await decodeImage(file); const result = dimensionsOf(image); releaseImage(image); return result; }
const hex = (value: string) => {
  const raw = value.replace("#", "");
  const normalized = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(normalized, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
};
const mime: Record<Format, string> = { PNG: "image/png", JPEG: "image/jpeg", WebP: "image/webp", AVIF: "image/avif", BMP: "image/bmp", ICO: "image/x-icon" };
export const extension = (format: Format) => format === "JPEG" ? "jpg" : format.toLowerCase();
export const formatBytes = (value: number) => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB` : `${(value / 1048576).toFixed(value < 10485760 ? 1 : 0)} MB`;

const hsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > .5 ? delta / (2 - max - min) : delta / (max + min);
  const h = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: h * 60, s, l };
};
const rgb = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const value = Math.round(l * 255); return { r: value, g: value, b: value }; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => { let x = t; if (x < 0) x += 1; if (x > 1) x -= 1; return x < 1/6 ? p + (q-p)*6*x : x < 1/2 ? q : x < 2/3 ? p + (q-p)*(2/3-x)*6 : p; };
  return { r: Math.round(f(hue + 1/3) * 255), g: Math.round(f(hue) * 255), b: Math.round(f(hue - 1/3) * 255) };
};
const crop = (width: number, height: number, config: Config) => {
  let ratio = width / height;
  if (config.aspect !== "free") { const [a, b] = config.aspect.split(":").map(Number); ratio = a / b; }
  let w = width, h = w / ratio;
  if (h > height) { h = height; w = h * ratio; }
  w /= config.cropZoom; h /= config.cropZoom;
  return { x: clamp(config.cropX) * (width - w), y: clamp(config.cropY) * (height - h), w, h };
};
const rounded = (ctx: CanvasRenderingContext2D, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(r, 0); ctx.arcTo(width, 0, width, height, r); ctx.arcTo(width, height, 0, height, r); ctx.arcTo(0, height, 0, 0, r); ctx.arcTo(0, 0, width, 0, r); ctx.closePath();
};
const hasPixels = (config: Config) => config.effect || config.brightness || config.contrast || config.saturation || config.exposure || config.temperature || config.hue || config.red || config.green || config.blue || config.alpha !== 100 || config.removeBackground || config.toolId === "transparent";

function adjust(ctx: CanvasRenderingContext2D, width: number, height: number, config: Config, signal?: AbortSignal) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const key = hex(config.keyColor);
  const edge = { r: 0, g: 0, b: 0 };
  if (config.removeBackground) {
    [0, width - 1, width * (height - 1), width * height - 1].forEach((pixel) => { edge.r += data[pixel * 4]; edge.g += data[pixel * 4 + 1]; edge.b += data[pixel * 4 + 2]; });
    edge.r /= 4; edge.g /= 4; edge.b /= 4;
  }
  const contrast = (259 * (config.contrast + 255)) / (255 * (259 - config.contrast));
  const dark = hex(config.dark), light = hex(config.light);
  for (let index = 0; index < data.length; index += 4) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    let r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3];
    r += config.brightness * 2.55 + config.red * 2.55; g += config.brightness * 2.55 + config.green * 2.55; b += config.brightness * 2.55 + config.blue * 2.55;
    r = contrast * (r - 128) + 128; g = contrast * (g - 128) + 128; b = contrast * (b - 128) + 128;
    const luminance = r*.2126 + g*.7152 + b*.0722;
    const sat = 1 + config.saturation / 100;
    r = luminance + (r - luminance) * sat; g = luminance + (g - luminance) * sat; b = luminance + (b - luminance) * sat;
    const exposure = Math.pow(2, config.exposure); r *= exposure; g *= exposure; b *= exposure;
    r += config.temperature * 1.35; b -= config.temperature * 1.35;
    if (config.hue) { const value = hsl(r, g, b); const shifted = rgb(value.h + config.hue, value.s, value.l); r = shifted.r; g = shifted.g; b = shifted.b; }
    if (config.effect === "grayscale") { const gray = r*.2126 + g*.7152 + b*.0722; r = g = b = gray; }
    if (config.effect === "sepia") { const ar = r, ag = g, ab = b, m = config.amount / 100; r = ar*(1-m) + (ar*.393+ag*.769+ab*.189)*m; g = ag*(1-m)+(ar*.349+ag*.686+ab*.168)*m; b = ab*(1-m)+(ar*.272+ag*.534+ab*.131)*m; }
    if (config.effect === "invert") { r = 255-r; g = 255-g; b = 255-b; }
    if (config.effect === "posterize") { const step = 255 / Math.max(1, config.posterize - 1); r = Math.round(r/step)*step; g = Math.round(g/step)*step; b = Math.round(b/step)*step; }
    if (config.effect === "threshold") { const v = luminance >= config.threshold ? 255 : 0; r = g = b = v; }
    if (config.effect === "duotone") { const v = clamp(luminance / 255); r = dark.r + (light.r-dark.r)*v; g = dark.g + (light.g-dark.g)*v; b = dark.b+(light.b-dark.b)*v; }
    if (config.effect === "grain") { const n = (Math.random()-.5)*config.amount*2; r += n; g += n; b += n; }
    if (config.effect === "scanlines" && Math.floor(index / 4 / width) % 3 === 1) { const m = 1-config.amount/150; r *= m; g *= m; b *= m; }
    const target = config.removeBackground ? edge : key;
    if ((config.removeBackground || config.toolId === "transparent") && Math.hypot(r-target.r, g-target.g, b-target.b) <= config.tolerance) a = 0;
    data[index] = clamp(r, 0, 255); data[index+1] = clamp(g,0,255); data[index+2] = clamp(b,0,255); data[index+3] = clamp(a * config.alpha / 100,0,255);
  }
  ctx.putImageData(image, 0, 0);
}

const pixelate = (target: HTMLCanvasElement, block: number) => {
  const small = surface(Math.max(1, Math.ceil(target.width / block)), Math.max(1, Math.ceil(target.height / block)));
  const smallCtx = context(small); smallCtx.imageSmoothingEnabled = false; smallCtx.drawImage(target, 0, 0, small.width, small.height);
  const out = context(target); out.clearRect(0, 0, target.width, target.height); out.imageSmoothingEnabled = false; out.drawImage(small, 0, 0, target.width, target.height); out.imageSmoothingEnabled = true;
};
const blur = (target: HTMLCanvasElement, value: number) => { const copy = surface(target.width, target.height); context(copy).drawImage(target,0,0); const ctx = context(target); ctx.clearRect(0,0,target.width,target.height); ctx.filter = `blur(${Math.max(.4,value)}px)`; ctx.drawImage(copy,0,0); ctx.filter = "none"; };
const sharpen = (target: HTMLCanvasElement, value: number) => {
  const ctx = context(target), image = ctx.getImageData(0,0,target.width,target.height), src = new Uint8ClampedArray(image.data);
  for (let y=1;y<target.height-1;y++) for (let x=1;x<target.width-1;x++) { const i=(y*target.width+x)*4; for(let c=0;c<3;c++){const high=src[i+c]*5-src[i-4+c]-src[i+4+c]-src[i-target.width*4+c]-src[i+target.width*4+c]; image.data[i+c]=clamp(src[i+c]+(high-src[i+c])*value,0,255);} }
  ctx.putImageData(image,0,0);
};
const applyMasks = (target: HTMLCanvasElement, masks: Mask[], config: Config) => {
  if (!masks.length) return;
  const ctx = context(target), copy = surface(target.width,target.height); context(copy).drawImage(target,0,0);
  masks.forEach((mask) => { const x=mask.x*target.width,y=mask.y*target.height,w=mask.width*target.width,h=mask.height*target.height; ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); if(mask.kind==="redact"){ctx.fillStyle=config.borderColor;ctx.fillRect(x,y,w,h);}else if(mask.kind==="blur"){ctx.filter=`blur(${Math.max(2,config.blur)}px)`;ctx.drawImage(copy,0,0);ctx.filter="none";}else{const area=surface(target.width,target.height);context(area).drawImage(copy,0,0);pixelate(area,Math.max(3,config.pixelSize));ctx.drawImage(area,0,0);}ctx.restore(); });
};
const trim = (source: HTMLCanvasElement) => {
  const data=context(source).getImageData(0,0,source.width,source.height).data;let l=source.width,t=source.height,r=-1,b=-1;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(data[(y*source.width+x)*4+3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  if(r<l) return source;const result=surface(r-l+1,b-t+1);context(result).drawImage(source,l,t,result.width,result.height,0,0,result.width,result.height);return result;
};

export async function render(sourceInput: RenderSource, config: Config, options: { max?: number; signal?: AbortSignal; stage?: (value: string) => void } = {}) {
  const ownsSource = sourceInput instanceof Blob;
  options.stage?.(ownsSource ? "Decoding" : "Rendering"); const bitmap = ownsSource ? await decodeImage(sourceInput) : sourceInput; if(options.signal?.aborted) { if (ownsSource) releaseImage(bitmap as DecodedImage); throw new DOMException("Operation cancelled","AbortError"); }
  const source=dimensionsOf(bitmap),box = crop(source.width,source.height,config), width0 = config.width ?? Math.round(box.w), height0 = config.height ?? Math.round(box.h), scale = Math.min(1,(options.max ?? Infinity)/Math.max(width0,height0));
  const width=Math.max(1,Math.round(width0*scale)),height=Math.max(1,Math.round(height0*scale)),pad=Math.round(config.padding*scale), reflection=config.effect==="reflection";
  const output=surface(width+pad*2,height+pad*2+(reflection?Math.round(height*.35):0)),ctx=context(output);
  options.stage?.("Rendering");
  if(config.padding||config.toolId==="background"){ctx.fillStyle=config.padding?config.paddingColor:config.background;ctx.fillRect(0,0,output.width,output.height);}
  if(config.toolId==="corners"){ctx.save();rounded(ctx,output.width,output.height,config.radius*scale);ctx.clip();}
  ctx.save();ctx.translate(pad+width/2,pad+height/2);ctx.rotate(config.rotation*Math.PI/180);ctx.scale(config.flipX?-1:1,config.flipY?-1:1);if(config.toolId==="shadow"){ctx.shadowColor=`rgba(0,0,0,${config.shadowOpacity/100})`;ctx.shadowBlur=config.shadowBlur*scale;ctx.shadowOffsetY=config.shadowOffset*scale;}if(config.effect==="mirror")ctx.scale(-1,1);ctx.drawImage(bitmap,box.x,box.y,box.w,box.h,-width/2,-height/2,width,height);ctx.restore();if(config.toolId==="corners")ctx.restore();
  if(reflection){const refl=surface(width,height),rctx=context(refl);rctx.translate(0,height);rctx.scale(1,-1);rctx.drawImage(output,pad,pad,width,height,0,0,width,height);rctx.setTransform(1,0,0,1,0,0);const fade=rctx.createLinearGradient(0,0,0,height);fade.addColorStop(0,"rgba(255,255,255,.35)");fade.addColorStop(1,"rgba(255,255,255,1)");rctx.globalCompositeOperation="destination-out";rctx.fillStyle=fade;rctx.fillRect(0,0,width,height);rctx.globalCompositeOperation="source-over";ctx.globalAlpha=clamp(config.amount/100,.15,.75);ctx.drawImage(refl,pad,pad+height,width,Math.round(height*.35));ctx.globalAlpha=1;}
  if(config.toolId==="border"){ctx.strokeStyle=config.borderColor;ctx.lineWidth=Math.max(1,config.borderWidth*scale*2);ctx.strokeRect(ctx.lineWidth/2,ctx.lineWidth/2,output.width-ctx.lineWidth,output.height-ctx.lineWidth);}
  options.stage?.("Applying effects"); if(hasPixels(config))adjust(ctx,output.width,output.height,config,options.signal);if(config.effect==="pixelate")pixelate(output,Math.max(2,Math.round(config.pixelSize*scale)));if(config.effect==="blur")blur(output,config.blur*scale);if(config.effect==="sharpen")sharpen(output,config.sharpen);if(config.effect==="vignette"){const g=ctx.createRadialGradient(output.width/2,output.height/2,Math.min(output.width,output.height)*.16,output.width/2,output.height/2,Math.max(output.width,output.height)*.75);g.addColorStop(.45,"transparent");g.addColorStop(1,`rgba(0,0,0,${clamp(config.amount/100,0,.82)})`);ctx.fillStyle=g;ctx.fillRect(0,0,output.width,output.height);}applyMasks(output,config.masks,config);
  if(config.text.trim()){ctx.save();ctx.globalAlpha=config.textOpacity/100;ctx.font=`700 ${Math.max(12,config.textSize*scale)}px ui-sans-serif,system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=Math.max(2,config.textSize*scale*.08);ctx.strokeStyle="rgba(0,0,0,.35)";ctx.fillStyle=config.textColor;ctx.strokeText(config.text,config.textX*output.width,config.textY*output.height,output.width*.84);ctx.fillText(config.text,config.textX*output.width,config.textY*output.height,output.width*.84);ctx.restore();}
  if (ownsSource) releaseImage(bitmap as DecodedImage);return config.trim||config.toolId==="trim"?trim(output):output;
}

/**
 * Render a stack without mutating the imported source. Each enabled operation
 * receives the prior persistent canvas directly, so effect order (and
 * duplicate operations) is deterministic without repeatedly encoding and
 * decoding intermediate previews. The imported File remains untouched.
 */
export async function renderStack(sourceInput: RenderSource, operations: ImageOperation[], options: { max?: number; signal?: AbortSignal; stage?: (value: string) => void } = {}) {
  const active = [...operations].filter((operation) => operation.enabled).sort((a, b) => a.order - b.order);
  if (!active.length) return render(sourceInput, defaultConfig, options);

  let source: RenderSource = sourceInput;
  let output: HTMLCanvasElement | null = null;
  for (let index = 0; index < active.length; index += 1) {
    if (options.signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const operation = active[index];
    output = await render(source, operation.config, {
      ...options,
      max: index === 0 ? options.max : undefined,
      stage: options.stage ? (stage) => options.stage?.(`${stage} · ${index + 1}/${active.length}`) : undefined,
    });
    if (index < active.length - 1) source = output;
  }
  return output ?? render(sourceInput, defaultConfig, options);
}

export const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error("This browser could not encode the image.")),type,quality));
const bmp = (canvas: HTMLCanvasElement) => { const image=context(canvas).getImageData(0,0,canvas.width,canvas.height),row=Math.ceil(canvas.width*3/4)*4,bytes=54+row*canvas.height,buffer=new ArrayBuffer(bytes),view=new DataView(buffer);view.setUint8(0,66);view.setUint8(1,77);view.setUint32(2,bytes,true);view.setUint32(10,54,true);view.setUint32(14,40,true);view.setInt32(18,canvas.width,true);view.setInt32(22,canvas.height,true);view.setUint16(26,1,true);view.setUint16(28,24,true);view.setUint32(34,row*canvas.height,true);for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const src=((canvas.height-1-y)*canvas.width+x)*4,dst=54+y*row+x*3;view.setUint8(dst,image.data[src+2]);view.setUint8(dst+1,image.data[src+1]);view.setUint8(dst+2,image.data[src]);}return new Blob([buffer],{type:mime.BMP}); };
const ico = async (canvas: HTMLCanvasElement) => { const png=await toBlob(canvas,"image/png"),data=new Uint8Array(await png.arrayBuffer()),buffer=new Uint8Array(22+data.length),view=new DataView(buffer.buffer);view.setUint16(2,1,true);view.setUint16(4,1,true);buffer[6]=canvas.width>=256?0:canvas.width;buffer[7]=canvas.height>=256?0:canvas.height;view.setUint16(10,1,true);view.setUint16(12,32,true);view.setUint32(14,data.length,true);view.setUint32(18,22,true);buffer.set(data,22);return new Blob([buffer],{type:mime.ICO}); };
export async function encode(canvas: HTMLCanvasElement, format: Format, quality: number, targetKB: number | null, signal?: AbortSignal) {
  if(signal?.aborted)throw new DOMException("Operation cancelled","AbortError");if(format==="BMP")return {blob:bmp(canvas),format};if(format==="ICO")return{blob:await ico(canvas),format};const make=(q:number)=>toBlob(canvas,mime[format],q/100);
  if(targetKB&&["JPEG","WebP","AVIF"].includes(format)){let low=12,high=Math.max(12,quality),best=await make(low);for(let i=0;i<7;i++){if(signal?.aborted)throw new DOMException("Operation cancelled","AbortError");const mid=Math.round((low+high)/2),candidate=await make(mid);if(candidate.size<=targetKB*1024){best=candidate;low=mid+1;}else high=mid-1;}return{blob:best,format:best.type===mime[format]?format:"PNG" as Format};}
  const blob=await make(quality);return{blob,format:blob.type===mime[format]?format:"PNG" as Format};
}

export async function palette(file: File, count: number) { const bitmap=await decodeImage(file),source=dimensionsOf(bitmap),scale=Math.min(1,180/Math.max(source.width,source.height)),canvas=surface(source.width*scale,source.height*scale),ctx=context(canvas);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);releaseImage(bitmap);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,bins=new Map<string,{r:number;g:number;b:number;n:number}>();for(let i=0;i<pixels.length;i+=16){if(pixels[i+3]<150)continue;const r=Math.round(pixels[i]/24)*24,g=Math.round(pixels[i+1]/24)*24,b=Math.round(pixels[i+2]/24)*24,key=`${r},${g},${b}`,bin=bins.get(key)??{r,g,b,n:0};bin.n++;bins.set(key,bin);}const chosen:Array<{r:number;g:number;b:number}>=[];for(const bin of [...bins.values()].sort((a,b)=>b.n-a.n)){if(chosen.every((v)=>Math.hypot(v.r-bin.r,v.g-bin.g,v.b-bin.b)>52)||chosen.length<2)chosen.push(bin);if(chosen.length>=count)break;}return chosen.map(({r,g,b})=>{const hue=hsl(r,g,b);return{hex:`#${[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase()}`,rgb:`rgb(${r}, ${g}, ${b})`,hsl:`hsl(${Math.round(hue.h)}, ${Math.round(hue.s*100)}%, ${Math.round(hue.l*100)}%)`};}); }

export async function grid(files: File[], config: Config, signal?: AbortSignal) { const selected=files.slice(0,24);if(!selected.length)throw new Error("Select at least one image.");const tile=640,gap=Math.max(0,config.gridGap),cols=Math.max(1,Math.min(config.gridColumns,selected.length)),rows=Math.ceil(selected.length/cols),canvas=surface(cols*tile+(cols+1)*gap,rows*tile+(rows+1)*gap),ctx=context(canvas);ctx.fillStyle=config.background;ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<selected.length;i++){if(signal?.aborted)throw new DOMException("Operation cancelled","AbortError");const bitmap=await decodeImage(selected[i]),source=dimensionsOf(bitmap),scale=Math.max(tile/source.width,tile/source.height),w=source.width*scale,h=source.height*scale,x=gap+(i%cols)*(tile+gap),y=gap+Math.floor(i/cols)*(tile+gap);ctx.drawImage(bitmap,x+(tile-w)/2,y+(tile-h)/2,w,h);releaseImage(bitmap);}return canvas; }

export const forTool = (current: Config, id: string): Config => {
  const next={...current,toolId:id};
  const effect: Record<string,string>={pixelate:"pixelate",blur:"blur",sharpen:"sharpen",grayscale:"grayscale",sepia:"sepia",invert:"invert",posterize:"posterize",grain:"grain",vignette:"vignette",threshold:"threshold",duotone:"duotone",scanlines:"scanlines",mirror:"mirror",reflection:"reflection"};
  if(effect[id])return{...next,effect:effect[id],removeBackground:false,trim:false};
  if(id==="compress")return{...next,format:"WebP",quality:82,targetKB:null,effect:null};
  if(id==="web")return{...next,format:"WebP",quality:80,targetKB:null,effect:null};
  if(id==="strip"||id==="convert")return{...next,effect:null};
  if(id==="remove-bg")return{...next,removeBackground:true,effect:null};
  if(id==="transparent")return{...next,removeBackground:false,effect:null};
  if(id==="trim")return{...next,trim:true,effect:null};
  if(id==="background")return{...next,effect:null};
  if(id==="watermark")return{...next,text:current.text||"© ImageLab",textOpacity:58,effect:null};
  if(id==="text")return{...next,text:current.text||"Your text",effect:null};
  if(id==="favicon")return{...next,width:current.iconSize,height:current.iconSize,aspect:"1:1",format:"ICO",effect:null};
  if(id==="thumbnail")return{...next,width:1280,height:720,aspect:"16:9",effect:null};
  if(id==="blur-selection")return{...next,masks:current.masks.map(m=>({...m,kind:"blur"})),effect:null};
  if(id==="pixelate-selection")return{...next,masks:current.masks.map(m=>({...m,kind:"pixelate"})),effect:null};
  if(id==="redact")return{...next,masks:current.masks.map(m=>({...m,kind:"redact"})),effect:null};
  return {...next,effect:null};
};
