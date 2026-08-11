"use client";
/* eslint-disable @next/next/no-img-element -- User-provided Blob URLs require native local image elements. */
/* eslint-disable react-hooks/refs -- Transaction refs are read from event handlers and async local processors, never rendered directly. */

import {
  ArrowDown, ArrowDownToLine, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronRight, ClipboardPaste, Command, Copy, CopyPlus, Download, ExternalLink, Eye, EyeOff, FileImage, FolderOpen, Github, Grid3X3, GripVertical, ImageDown, Info, Layers3, Moon, Move, MoreHorizontal, Palette, Plus, Redo2, RefreshCw, RotateCcw, RotateCw, Search, SlidersHorizontal, Sparkles, Star, Sun, Trash2, Undo2, Upload, Wand2, X, ZoomIn, ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { categories, fuzzy, getTool, tools, type Category, type Tool } from "../lib/tools";
import { clamp, decodeImage, defaultConfig, encode, extension, forTool, formatBytes, grid, imageDimensions, palette, releaseImage, renderStack, type Config, type DecodedImage, type Format, type ImageOperation, type Mask } from "../lib/processor";
import { getSettingsSection, isSettingsSection, searchSettings, settingsSections, type SettingsSection } from "../lib/settings-registry";
import { activateServiceWorkerUpdate, checkServiceWorkerUpdate, registerImageLabServiceWorker, waitForServiceWorkerControllerChange } from "../lib/service-worker";
import { checkForUpdates, releaseSummary, type ReleaseInfo } from "../lib/updates";
import { consumePendingUpdateWorkspace, savePendingUpdateWorkspace, type PendingUpdateWorkspace } from "../lib/workspace-update";
import { APP_BUILD, APP_REPOSITORY_URL, APP_RELEASES_API_URL, APP_VERSION } from "../lib/version";

type Status = "reading" | "ready" | "processing" | "failed";
export type Item = { id: string; file: File; url: string; name: string; size: number; type: string; width?: number; height?: number; status: Status; progress?: number; error?: string; outputSize?: number; outputFormat?: Format };
type Theme = "light" | "dark" | "system";
type Section = "workspace" | "tools" | "recent" | "settings";
type Settings = { theme: Theme; preview: "fast" | "balanced" | "high"; memory: boolean; motion: boolean; saveCopies: boolean; naming: "original" | "imagelab"; density: "comfortable" | "compact"; autoUpdateChecks: boolean };
type Recent = { id: string; name: string; size: number; width?: number; height?: number; type: string; at: number };
type Job = { phase: "idle" | "processing" | "zipping" | "done" | "cancelled" | "failed"; current: number; total: number; progress: number; text?: string };
type Drag = { id: number; mode: "draw" | "move" | "resize"; mask?: Mask; point: { x: number; y: number } };
type Operation = ImageOperation;
type OutputSettings = Pick<Config, "format" | "quality" | "targetKB">;
type EditorSnapshot = { operations: Operation[]; selectedOperationId: string | null; config: Config; output: OutputSettings };
type ContextTarget = { kind: "file"; id: string } | { kind: "tool"; id: string } | { kind: "operation"; id: string } | { kind: "canvas" };
export type ContextState = { target: ContextTarget; x: number; y: number } | null;
export type MenuAction = { id: string; label: string; icon: LucideIcon; run: () => void; disabled?: boolean; tone?: "danger" } | { id: string; separator: true };
type LongPress = { key: string; target: ContextTarget; timer: number; x: number; y: number; startX: number; startY: number };
type RenameDialogState = { id: string; value: string } | null;
type EditorRoute = { kind: "home"; workspaceId: string } | { kind: "editor"; workspaceId: string; toolId: string } | { kind: "settings"; workspaceId: string; section: SettingsSection };
type WorkspaceSnapshot = { files: Item[]; active: string | null; selected: string[]; toolId: string; config: Config; output: OutputSettings; operations: Operation[]; selectedOperationId: string | null; undo: EditorSnapshot[]; redo: EditorSnapshot[]; zoom: number; pan: { x: number; y: number }; compare: boolean; selectedMask: string | null };
type PreviewFrame = { fileId: string; canvas: HTMLCanvasElement };
type SourceFrame = { fileId: string; source: DecodedImage };
type SheetState = "collapsed" | "medium" | "expanded";
type UpdateState = { status: "idle" | "checking" | "current" | "available" | "offline" | "error" | "applying"; latest: ReleaseInfo | null; workerReady: boolean; checkedAt: number | null; message?: string };

const settingKey = "imagelab:settings";
const favoriteKey = "imagelab:favorites";
const recentKey = "imagelab:recents";
const toolHistoryKey = "imagelab:tool-history";
const updateCheckKey = "imagelab:update-last-check";
const updateNoticeKey = "imagelab:update-notice-dismissed";
const emptySettings: Settings = { theme: "system", preview: "balanced", memory: false, motion: false, saveCopies: false, naming: "imagelab", density: "comfortable", autoUpdateChecks: true };
const accept = ".png,.jpg,.jpeg,.webp,.avif,.gif,.bmp,.ico,.svg,image/*";
const icon: Record<string, LucideIcon> = { compress: ImageDown, spark: Sparkles, shield: EyeOff, resize: Move, crop: Grid3X3, rotate: RotateCw, frame: Layers3, thumb: ImageDown, convert: RotateCw, pixel: Grid3X3, blur: Sparkles, focus: Eye, mono: Palette, tone: Sparkles, invert: Moon, layers: Layers3, grain: Sparkles, vignette: Eye, threshold: SlidersHorizontal, duotone: Palette, scan: Grid3X3, sliders: SlidersHorizontal, palette: Palette, erase: Wand2, drop: Sparkles, paint: Palette, trim: Move, mask: Eye, redact: EyeOff, text: Command, watermark: Check, corner: Grid3X3, border: Grid3X3, shadow: Layers3, mirror: Move, reflection: Layers3, grid: Grid3X3, app: FileImage, info: Info };
const getId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const defaultWorkspaceId = "default";
const routeHref = (toolId: string, workspaceId = defaultWorkspaceId) => `${getTool(toolId).route}${workspaceId === defaultWorkspaceId ? "" : `?workspace=${encodeURIComponent(workspaceId)}`}`;
const settingsHref = (section: SettingsSection, workspaceId = defaultWorkspaceId) => {
  const pathname = section === "overview" ? "/settings" : `/settings/${section}`;
  return `${pathname}${workspaceId === defaultWorkspaceId ? "" : `?workspace=${encodeURIComponent(workspaceId)}`}`;
};
const browserRoute = (): EditorRoute => {
  if (typeof window === "undefined") return { kind: "home", workspaceId: defaultWorkspaceId };
  const settingsMatch = window.location.pathname.match(/^\/settings(?:\/([^/]+))?\/?$/);
  if (settingsMatch) {
    const section = settingsMatch[1] ?? "overview";
    return { kind: "settings", section: isSettingsSection(section) ? section : "overview", workspaceId: new URLSearchParams(window.location.search).get("workspace") || defaultWorkspaceId };
  }
  const match = window.location.pathname.match(/^\/tools\/([^/]+)/);
  const toolId = match?.[1];
  if (toolId && tools.some((item) => item.id === toolId)) return { kind: "editor", toolId, workspaceId: new URLSearchParams(window.location.search).get("workspace") || defaultWorkspaceId };
  return { kind: "home", workspaceId: defaultWorkspaceId };
};
const Icon = ({ name, size = 16 }: { name: string; size?: number }) => { const Component = icon[name] ?? Wand2; return <Component size={size} aria-hidden="true" />; };
const fileBase = (name: string) => name.replace(/\.[^.]+$/, "") || "image";
const displayDimensions = (width?: number, height?: number) => width && height ? `${width.toLocaleString()} × ${height.toLocaleString()}` : "—";
const download = (blob: Blob, name: string) => { const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0); };
const outputFrom = (config: Config): OutputSettings => ({ format: config.format, quality: config.quality, targetKB: config.targetKB });
const clone = <Value,>(value: Value): Value => structuredClone(value);
const toolDefaults = (id: string, output: OutputSettings = outputFrom(defaultConfig)) => ({ ...forTool(clone(defaultConfig), id), ...output });
const operationSummary = (operation: Operation) => {
  const config = operation.config;
  switch (operation.toolId) {
    case "resize": case "thumbnail": return `${config.width ?? "Auto"} × ${config.height ?? "Auto"}`;
    case "crop": return config.aspect === "free" ? `Crop ${config.cropZoom.toFixed(2)}×` : `Crop ${config.aspect}`;
    case "rotate": return `${config.rotation}°${config.flipX || config.flipY ? " · flipped" : ""}`;
    case "pixelate": case "pixelate-selection": return `${config.pixelSize}px`;
    case "blur": case "blur-selection": return `${config.blur}px`;
    case "threshold": return `${config.threshold}`;
    case "sharpen": return `${Math.round(config.sharpen * 100)}%`;
    case "brightness": return `${config.brightness > 0 ? "+" : ""}${config.brightness}`;
    case "color": return [config.brightness && `B ${config.brightness > 0 ? "+" : ""}${config.brightness}`, config.contrast && `C ${config.contrast > 0 ? "+" : ""}${config.contrast}`, config.saturation && `S ${config.saturation > 0 ? "+" : ""}${config.saturation}`].filter(Boolean).join(" · ") || "Color adjustments";
    case "vignette": case "sepia": case "grain": case "scanlines": case "reflection": return `${config.amount}%`;
    case "padding": return `${config.padding}px`;
    case "border": return `${config.borderWidth}px`;
    case "corners": return `${config.radius}px`;
    case "text": case "watermark": return config.text.slice(0, 22) || "Text";
    default: return getTool(operation.toolId).name;
  }
};

function PixelLogo() { return <span className="pixel-logo" aria-hidden="true"><i /><i /><i /><i /></span>; }
export function Button({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) { return <button className={`button ${className}`} {...props}>{children}</button>; }
export function ImageLabTooltip({ label, children }: { label: string; children: ReactNode }) { return <span className="il-tooltip"><span>{children}</span><i role="tooltip">{label}</i></span>; }
export function IconButton({ label, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; className?: string }) { return <button aria-label={label} className={`icon-button ${className}`} {...props}>{children}</button>; }

export function ImageLabSlider({ label, value, min, max, step = 1, unit = "", defaultValue, onChange, onCommit }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; defaultValue?: number; onChange: (value: number) => void; onCommit: () => void }) {
  const progress = `${((value - min) / Math.max(1, max - min)) * 100}%`;
  return <div className="slider"><span><b>{label}</b><em>{value}{unit}</em>{defaultValue !== undefined && value !== defaultValue && <button className="parameter-reset" type="button" onClick={()=>{onChange(defaultValue);onCommit();}} aria-label={`Reset ${label}`}><RotateCcw size={11}/></button>}</span><input aria-label={label} className="il-range" type="range" value={value} min={min} max={max} step={step} style={{"--slider-progress":progress} as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onCommit} onKeyUp={(event)=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key))onCommit();}} onDoubleClick={()=>{if(defaultValue!==undefined){onChange(defaultValue);onCommit();}}} /></div>;
}

function PersistentPreview({ file, sourceFrame, previewFrame, compare }: { file: Item; sourceFrame: SourceFrame | null; previewFrame: PreviewFrame | null; compare: boolean }) {
  const canvasRef=useRef<HTMLCanvasElement | null>(null);
  useEffect(()=>{
    const original=sourceFrame?.fileId===file.id?sourceFrame.source:null;
    const rendered=previewFrame?.fileId===file.id?previewFrame.canvas:null;
    const source=compare?original:(rendered??original);
    const canvas=canvasRef.current;
    if(!canvas||!source)return;
    const width="naturalWidth" in source?source.naturalWidth:source.width;
    const height="naturalHeight" in source?source.naturalHeight:source.height;
    if(!width||!height)return;
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const context=canvas.getContext("2d");
    if(!context)return;
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);context.drawImage(source,0,0,width,height);
  },[compare,file.id,previewFrame,sourceFrame]);
  return <canvas ref={canvasRef} className="preview-canvas" role="img" aria-label={`Preview of ${file.name}`} />;
}

export function ImageLabNumberInput({ value, min, max, step = 1, placeholder, unit, label, defaultValue, onChange, onCommit }: { value: number | null; min?: number; max?: number; step?: number; placeholder?: string; unit?: string; label: string; defaultValue?: number | null; onChange: (value: number | null) => void; onCommit: () => void }) {
  const [draft,setDraft]=useState({source:value,text:value===null?"":String(value)});
  const text=draft.source===value?draft.text:value===null?"":String(value);
  const setValue=(next:number|null,nextText=next===null?"":String(next))=>{setDraft({source:next,text:nextText});onChange(next);};
  const normalize=(next:string,finish=false)=>{const raw=next.trim();if(!raw){setValue(null,"");if(finish)onCommit();return;}const parsed=Number(raw);if(!Number.isFinite(parsed)){setDraft({source:value,text:finish?(value===null?"":String(value)):next});return;}const bounded=clamp(parsed,min??-Infinity,max??Infinity);setValue(bounded,finish?String(bounded):next);if(finish)onCommit();};
  const nudge=(direction:number)=>{const next=clamp((value??min??0)+direction*step,min??-Infinity,max??Infinity);setValue(next);onCommit();};
  return <div className="il-number"><input aria-label={label} type="text" inputMode="decimal" value={text} placeholder={placeholder} onChange={(event)=>normalize(event.target.value)} onBlur={()=>normalize(text,true)} onKeyDown={(event)=>{if(event.key==="ArrowUp"||event.key==="ArrowDown"){event.preventDefault();nudge(event.key==="ArrowUp"?1:-1);}if(event.key==="Enter"){event.currentTarget.blur();}}}/>{unit&&<small>{unit}</small>}{defaultValue !== undefined && value !== defaultValue && <button type="button" className="parameter-reset" onClick={()=>{setValue(defaultValue);onCommit();}} aria-label={`Reset ${label}`}><RotateCcw size={11}/></button>}</div>;
}

export function ImageLabSelect({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean }) {
  const triggerRef=useRef<HTMLButtonElement | null>(null),menuRef=useRef<HTMLDivElement | null>(null);
  const [open,setOpen]=useState(false),[activeIndex,setActiveIndex]=useState(Math.max(0,options.findIndex((option)=>option.value===value))),[position,setPosition]=useState({left:0,top:0,minWidth:0});
  const selected=options.find((option)=>option.value===value)??options[0];
  const place=useCallback(()=>{const rect=triggerRef.current?.getBoundingClientRect();if(!rect)return;const width=Math.max(rect.width,178),height=Math.min(240,options.length*34+10),left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top=rect.bottom+6+height<window.innerHeight?rect.bottom+6:Math.max(8,rect.top-height-6);setPosition({left,top,minWidth:width});},[options.length]);
  useEffect(()=>{if(!open)return;place();const close=(event:PointerEvent)=>{const target=event.target as Node;if(!triggerRef.current?.contains(target)&&!menuRef.current?.contains(target))setOpen(false);};const resize=()=>place();document.addEventListener("pointerdown",close);window.addEventListener("resize",resize);window.addEventListener("scroll",resize,true);return()=>{document.removeEventListener("pointerdown",close);window.removeEventListener("resize",resize);window.removeEventListener("scroll",resize,true);};},[open,place]);
  const choose=(next:string)=>{onChange(next);setOpen(false);window.requestAnimationFrame(()=>triggerRef.current?.focus());};
  const move=(direction:number)=>setActiveIndex((index)=>(index+direction+options.length)%options.length);
  const onKey=(event:ReactKeyboardEvent<HTMLButtonElement | HTMLDivElement>)=>{if(event.key==="Escape"){event.preventDefault();setOpen(false);triggerRef.current?.focus();return;}if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();if(!open)setOpen(true);move(event.key==="ArrowDown"?1:-1);return;}if(event.key==="Home"||event.key==="End"){event.preventDefault();setActiveIndex(event.key==="Home"?0:options.length-1);return;}if((event.key==="Enter"||event.key===" ")&&open){event.preventDefault();choose(options[activeIndex]?.value??value);}};
  return <div className="il-select"><button ref={triggerRef} type="button" className="il-select-trigger" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={()=>{setActiveIndex(Math.max(0,options.findIndex((option)=>option.value===value)));setOpen((state)=>!state);}} onKeyDown={onKey}><span>{selected?.label}</span><ChevronDown size={14}/></button>{open&&<div ref={menuRef} className="il-select-menu" role="listbox" aria-label={label} style={{left:position.left,top:position.top,minWidth:position.minWidth}} onKeyDown={onKey}>{options.map((option,index)=><button key={option.value} role="option" aria-selected={option.value===value} className={index===activeIndex?"active":""} onMouseEnter={()=>setActiveIndex(index)} onClick={()=>choose(option.value)}><span>{option.label}</span>{option.value===value&&<Check size={14}/>}</button>)}</div>}</div>;
}

export function ImageLabColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const picker=useRef<HTMLInputElement | null>(null);return <label className="color"><b>{label}</b><span><button type="button" className="color-swatch" style={{background:value}} aria-label={`Choose ${label}`} onClick={()=>picker.current?.click()} /><input ref={picker} className="sr-only" tabIndex={-1} type="color" value={value} onChange={(event)=>onChange(event.target.value)} /><input className="color-value" value={value.toUpperCase()} aria-label={`${label} value`} onChange={(event)=>/^#[0-9a-fA-F]{0,6}$/.test(event.target.value)&&onChange(event.target.value)} /></span></label>; }
export function ImageLabSwitch({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (value: boolean) => void }) { return <label className="toggle"><span><b>{label}</b>{help&&<small>{help}</small>}</span><input className="control-input" type="checkbox" checked={value} onChange={(event)=>onChange(event.target.checked)} /><i aria-hidden="true" /></label>; }
export function ImageLabCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="il-checkbox" aria-label={label} onClick={(event)=>event.stopPropagation()}><input className="control-input" type="checkbox" checked={checked} onChange={onChange}/><i aria-hidden="true"><Check size={10}/></i></label>; }
export function ImageLabProgress({ value, label }: { value: number; label: string }) { return <div className="il-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{width:`${value}%`}}/></div>; }
export function ImageLabDisclosure({label,children}:{label:string;children:ReactNode}) { const [open,setOpen]=useState(false);return <div className="advanced-disclosure"><button type="button" aria-expanded={open} onClick={()=>setOpen((value)=>!value)}><ChevronRight size={13}/>{label}</button>{open&&<div>{children}</div>}</div>; }
const Slider = ImageLabSlider;
const Color = ImageLabColorField;
const Toggle = ImageLabSwitch;

export default function ImageLab({ initialToolId, initialWorkspaceId, initialSettingsSection }: { initialToolId?: string; initialWorkspaceId?: string; initialSettingsSection?: SettingsSection }) {
  const initialRouteRef = useRef<EditorRoute>(initialToolId && tools.some((item)=>item.id===initialToolId) ? {kind:"editor",toolId:initialToolId,workspaceId:initialWorkspaceId || defaultWorkspaceId} : initialSettingsSection && isSettingsSection(initialSettingsSection) ? {kind:"settings",section:initialSettingsSection,workspaceId:initialWorkspaceId || defaultWorkspaceId} : browserRoute());
  const initialSelectedTool = initialRouteRef.current.kind === "editor" ? initialRouteRef.current.toolId : "compress";
  const initialConfigRef = useRef<Config>(toolDefaults(initialSelectedTool));
  const routeRef = useRef<EditorRoute>(initialRouteRef.current);
  const appliedRouteRef = useRef<EditorRoute>(initialRouteRef.current);
  const workspacesRef = useRef<Map<string, WorkspaceSnapshot>>(new Map());
  const decodedSourcesRef = useRef<Map<string, DecodedImage>>(new Map());
  const previewFrameRef = useRef<PreviewFrame | null>(null);
  const serviceWorkerRef = useRef<ServiceWorkerRegistration | null>(null);
  const restoredUpdateWorkspaceRef = useRef(false);
  const activeRef = useRef<string | null>(null);
  const selectedRef = useRef<string[]>([]);
  const undoRef = useRef<EditorSnapshot[]>([]);
  const redoRef = useRef<EditorSnapshot[]>([]);
  const zoomRef = useRef(100);
  const panRef = useRef({x:0,y:0});
  const compareRef = useRef(false);
  const selectedMaskRef = useRef<string | null>(null);
  const filesRef = useRef<Item[]>([]);
  const dragDepth = useRef(0);
  const drawRef = useRef<Drag | null>(null);
  const beforeMask = useRef<Config | null>(null);
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const categoryDrag = useRef<{ id: number; x: number; scroll: number; moved: boolean } | null>(null);
  const toolRowIds = useRef<string[]>([]);
  const suppressCategoryClick = useRef(false);
  const longPress = useRef<LongPress | null>(null);
  const suppressLongPressClick = useRef<string | null>(null);
  const operationsRef = useRef<Operation[]>([]);
  const configRef = useRef<Config>(initialConfigRef.current);
  const outputRef = useRef<OutputSettings>(outputFrom(initialConfigRef.current));
  const selectedOperationRef = useRef<string | null>(null);
  const toolIdRef = useRef(initialSelectedTool);
  const historyGesture = useRef<EditorSnapshot | null>(null);
  const [route, setRoute] = useState<EditorRoute>(initialRouteRef.current);
  const [files, setFiles] = useState<Item[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [toolId, setToolId] = useState(initialSelectedTool);
  const [section, setSection] = useState<Section>("workspace");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(initialRouteRef.current.kind === "settings" ? initialRouteRef.current.section : "overview");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [settingsFocusId, setSettingsFocusId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | "All Tools" | "Favorites" | "Recent">("All Tools");
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState<Config>(initialConfigRef.current);
  const [output, setOutput] = useState<OutputSettings>(outputFrom(initialConfigRef.current));
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [undo, setUndo] = useState<EditorSnapshot[]>([]);
  const [redo, setRedo] = useState<EditorSnapshot[]>([]);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [toolHistory, setToolHistory] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  const [command, setCommand] = useState(false);
  const [query, setQuery] = useState("");
  const [previewFrame, setPreviewFrame] = useState<PreviewFrame | null>(null);
  const [sourceFrame, setSourceFrame] = useState<SourceFrame | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "working" | "error">("idle");
  const [previewInfo, setPreviewInfo] = useState<{ width: number; height: number; bytes?: number } | null>(null);
  const [previewMode, setPreviewMode] = useState<"interactive" | "full">("full");
  const [paletteData, setPaletteData] = useState<Array<{hex:string;rgb:string;hsl:string}>>([]);
  const [paletteCount, setPaletteCount] = useState(5);
  const [paletteState, setPaletteState] = useState<"idle" | "working" | "error">("idle");
  const [metadata, setMetadata] = useState<Record<string,unknown> | null>(null);
  const [metaState, setMetaState] = useState<"idle" | "working" | "error">("idle");
  const [copied, setCopied] = useState("");
  const [job, setJob] = useState<Job>({phase:"idle",current:0,total:0,progress:0});
  const [cancelProcess, setCancelProcess] = useState<(() => void) | null>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({x:0,y:0});
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState<{id:number;x:number;y:number;origin:{x:number;y:number}} | null>(null);
  const [compare, setCompare] = useState(false);
  const [selectedMask, setSelectedMask] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextState>(null);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState>(null);
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle", latest: null, workerReady: false, checkedAt: null });
  const [updateNoticeDismissed, setUpdateNoticeDismissed] = useState(false);
  const sheetDrag = useRef<{ id: number; y: number; state: SheetState; moved: boolean } | null>(null);
  const suppressSheetClick = useRef(false);

  const editorOpen = route.kind === "editor";
  const current = files.find((file)=>file.id===active) ?? files[0] ?? null;
  const tool = getTool(toolId);
  const chosen = files.filter((file)=>selected.includes(file.id));
  const processing = job.phase === "processing" || job.phase === "zipping";
  const selectedOperation = operations.find((operation)=>operation.instanceId===selectedOperationId) ?? null;
  const panelConfig = { ...config, ...output };
  const previewMax = settings.memory ? 720 : settings.preview === "fast" ? 920 : settings.preview === "high" ? 2048 : 1400;
  const setSetting = (next: Settings) => { setSettings(next); localStorage.setItem(settingKey,JSON.stringify(next)); };
  const clearSettingsFocus = useCallback(() => setSettingsFocusId(null), []);
  const updateConfig = useCallback((next: Config) => { configRef.current=next;setConfig(next); },[]);
  const updateOutput = useCallback((next: OutputSettings) => { outputRef.current=next;setOutput(next); },[]);
  const updateOperations = useCallback((next: Operation[] | ((current: Operation[])=>Operation[])) => { const value=typeof next==="function"?(next as (current:Operation[])=>Operation[])(operationsRef.current):next;operationsRef.current=value;setOperations(value);return value; },[]);
  const setSelectedOperation = useCallback((id: string | null) => { selectedOperationRef.current=id;setSelectedOperationId(id); },[]);
  const rememberWorkspace = useCallback((id: string) => {
    workspacesRef.current.set(id, {
      files: filesRef.current,
      active: activeRef.current,
      selected: selectedRef.current,
      toolId: toolIdRef.current,
      config: clone(configRef.current),
      output: {...outputRef.current},
      operations: clone(operationsRef.current),
      selectedOperationId: selectedOperationRef.current,
      undo: clone(undoRef.current),
      redo: clone(redoRef.current),
      zoom: zoomRef.current,
      pan: {...panRef.current},
      compare: compareRef.current,
      selectedMask: selectedMaskRef.current,
    });
  },[]);
  const restoreWorkspace = useCallback((id: string, requestedToolId: string) => {
    const cached = workspacesRef.current.get(id);
    const base = cached ?? { files: [], active: null, selected: [], toolId: requestedToolId, config: toolDefaults(requestedToolId), output: outputFrom(defaultConfig), operations: [], selectedOperationId: null, undo: [], redo: [], zoom: 100, pan: {x:0,y:0}, compare: false, selectedMask: null } satisfies WorkspaceSnapshot;
    const matching = [...base.operations].reverse().find((operation)=>operation.toolId===requestedToolId) ?? null;
    const nextConfig = matching ? {...matching.config,...base.output} : toolDefaults(requestedToolId,base.output);
    filesRef.current=base.files;setFiles(base.files);
    activeRef.current=base.active;setActive(base.active);
    selectedRef.current=base.selected;setSelected(base.selected);
    toolIdRef.current=requestedToolId;setToolId(requestedToolId);
    configRef.current=nextConfig;setConfig(nextConfig);
    outputRef.current=base.output;setOutput(base.output);
    operationsRef.current=clone(base.operations);setOperations(clone(base.operations));
    selectedOperationRef.current=matching?.instanceId ?? base.selectedOperationId;setSelectedOperationId(matching?.instanceId ?? base.selectedOperationId);
    undoRef.current=clone(base.undo);setUndo(clone(base.undo));
    redoRef.current=clone(base.redo);setRedo(clone(base.redo));
    zoomRef.current=base.zoom;setZoom(base.zoom);
    panRef.current={...base.pan};setPan({...base.pan});
    compareRef.current=base.compare;setCompare(base.compare);
    selectedMaskRef.current=base.selectedMask;setSelectedMask(base.selectedMask);
    setPreviewFrame(null);setSourceFrame(null);setPreviewInfo(null);setPreviewState("idle");setSection("workspace");setSheetState("collapsed");
  },[]);
  const applyTool = useCallback((id:string, recordHistory = true) => {
    const existing=[...operationsRef.current].reverse().find((operation)=>operation.toolId===id);
    toolIdRef.current=id;setToolId(id);setSection("workspace");setSelectedOperation(existing?.instanceId??null);updateConfig(existing?{...existing.config,...outputRef.current}:toolDefaults(id,outputRef.current));
    if(recordHistory)setToolHistory((old)=>{const next=[id,...old.filter((value)=>value!==id)].slice(0,8);localStorage.setItem(toolHistoryKey,JSON.stringify(next));return next;});
  },[setSelectedOperation,updateConfig]);
  const navigateTool = useCallback((id:string, options: { replace?: boolean; workspace?: string; newWorkspace?: boolean } = {}) => {
    const from=routeRef.current;
    const nextWorkspace=options.newWorkspace ? `workspace-${getId()}` : options.workspace ?? from.workspaceId;
    const next:EditorRoute={kind:"editor",toolId:id,workspaceId:nextWorkspace};
    if(from.kind==="editor"&&from.workspaceId!==nextWorkspace)rememberWorkspace(from.workspaceId);
    if(from.kind==="home"&&nextWorkspace===defaultWorkspaceId)rememberWorkspace(nextWorkspace);
    if(from.kind==="editor"&&from.workspaceId===nextWorkspace)applyTool(id);
    const method=options.replace?"replaceState":"pushState";
    window.history[method]({imagelab:true,workspaceId:nextWorkspace,toolId:id},"",routeHref(id,nextWorkspace));
    routeRef.current=next;setRoute(next);
  },[applyTool,rememberWorkspace]);
  const navigateSettings = useCallback((nextSection: SettingsSection = "overview", focusId: string | null = null, replace = false) => {
    const from=routeRef.current;
    if(from.kind==="editor")rememberWorkspace(from.workspaceId);
    const next:EditorRoute={kind:"settings",section:nextSection,workspaceId:from.workspaceId};
    window.history[replace?"replaceState":"pushState"]({imagelab:true,workspaceId:next.workspaceId,settingsSection:nextSection},"",settingsHref(nextSection,next.workspaceId));
    routeRef.current=next;setRoute(next);setSettingsSection(nextSection);setSettingsFocusId(focusId);setSection("workspace");
  },[rememberWorkspace]);
  const navigateHome = useCallback(() => {
    const from=routeRef.current;
    if(from.kind==="editor")rememberWorkspace(from.workspaceId);
    const next:EditorRoute={kind:"home",workspaceId:defaultWorkspaceId};
    window.history.pushState({imagelab:true},"","/");routeRef.current=next;setRoute(next);setSection("workspace");
  },[rememberWorkspace]);
  const replaceToolRoute = useCallback((id:string) => {
    const currentRoute=routeRef.current;
    const next:EditorRoute={kind:"editor",toolId:id,workspaceId:currentRoute.workspaceId};
    window.history.replaceState({imagelab:true,workspaceId:next.workspaceId,toolId:id},"",routeHref(id,next.workspaceId));routeRef.current=next;setRoute(next);
  },[]);
  const snapshot = useCallback(():EditorSnapshot=>({operations:clone(operationsRef.current),selectedOperationId:selectedOperationRef.current,config:clone(configRef.current),output:{...outputRef.current}}),[]);
  const sameSnapshot = (left:EditorSnapshot,right:EditorSnapshot) => JSON.stringify(left)===JSON.stringify(right);
  const recordSnapshot = useCallback((value:EditorSnapshot)=>{setUndo((history)=>[...history.slice(-39),value]);setRedo([]);},[]);
  const restoreSnapshot = useCallback((value:EditorSnapshot)=>{historyGesture.current=null;updateOperations(clone(value.operations));setSelectedOperation(value.selectedOperationId);updateConfig(clone(value.config));updateOutput({...value.output});},[setSelectedOperation,updateConfig,updateOperations,updateOutput]);
  const startHistory = useCallback(()=>{if(!historyGesture.current)historyGesture.current=snapshot();},[snapshot]);
  const commit = useCallback(()=>{const initial=historyGesture.current;historyGesture.current=null;if(initial&&!sameSnapshot(initial,snapshot()))recordSnapshot(initial);setPreviewMode("full");},[recordSnapshot,snapshot]);
  const mutate = useCallback((run:()=>void,record=true)=>{const initial=snapshot();if(record)recordSnapshot(initial);else startHistory();setPreviewMode(record?"full":"interactive");run();},[recordSnapshot,snapshot,startHistory]);
  const patch = useCallback((value: Partial<Config>, record = false) => {
    const initial=snapshot();
    if(record){historyGesture.current=null;recordSnapshot(initial);setPreviewMode("full");}else {startHistory();setPreviewMode("interactive");}
    const nextOutput={...outputRef.current};
    if(value.format!==undefined)nextOutput.format=value.format;
    if(value.quality!==undefined)nextOutput.quality=value.quality;
    if(value.targetKB!==undefined)nextOutput.targetKB=value.targetKB;
    if(JSON.stringify(nextOutput)!==JSON.stringify(outputRef.current))updateOutput(nextOutput);
    const operationPatch={...value};delete operationPatch.format;delete operationPatch.quality;delete operationPatch.targetKB;
    const operationTool=toolIdRef.current;
    const needsOperation=Object.keys(operationPatch).length>0&&!(["compress","web","strip","convert","grid","palette","metadata"] as string[]).includes(operationTool);
    let nextConfig={...configRef.current,...value};
    if(needsOperation){
      const existing=operationsRef.current.find((operation)=>operation.instanceId===selectedOperationRef.current);
      const base=existing?.config??toolDefaults(operationTool,nextOutput);
      const nextOperationConfig={...base,...operationPatch,toolId:existing?.toolId??operationTool};
      nextConfig={...nextOperationConfig,...nextOutput};
      if(existing){updateOperations((list)=>list.map((operation)=>operation.instanceId===existing.instanceId?{...operation,config:nextOperationConfig}:operation));}
      else {const created:Operation={instanceId:getId(),toolId:operationTool,enabled:true,order:operationsRef.current.length,config:nextOperationConfig};updateOperations((list)=>[...list,created]);setSelectedOperation(created.instanceId);}
    }
    updateConfig(nextConfig);
  },[recordSnapshot,setSelectedOperation,snapshot,startHistory,updateConfig,updateOperations,updateOutput]);
  const undoEdit = useCallback(()=>setUndo((history)=>{const previous=history.at(-1);if(!previous)return history;const currentSnapshot=snapshot();setRedo((next)=>[...next.slice(-39),currentSnapshot]);restoreSnapshot(previous);return history.slice(0,-1);}),[restoreSnapshot,snapshot]);
  const redoEdit = useCallback(()=>setRedo((history)=>{const next=history.at(-1);if(!next)return history;const currentSnapshot=snapshot();setUndo((past)=>[...past.slice(-39),currentSnapshot]);restoreSnapshot(next);return history.slice(0,-1);}),[restoreSnapshot,snapshot]);
  const editOperation = useCallback((id:string)=>{const operation=operationsRef.current.find((entry)=>entry.instanceId===id);if(!operation)return;setSelectedOperation(id);toolIdRef.current=operation.toolId;setToolId(operation.toolId);updateConfig({...operation.config,...outputRef.current});setSection("workspace");replaceToolRoute(operation.toolId);},[replaceToolRoute,setSelectedOperation,updateConfig]);
  const resetOperation = useCallback((id:string)=>{const operation=operationsRef.current.find((entry)=>entry.instanceId===id);if(!operation)return;mutate(()=>{const nextConfig=toolDefaults(operation.toolId,outputRef.current);updateOperations((list)=>list.map((entry)=>entry.instanceId===id?{...entry,config:nextConfig}:entry));if(selectedOperationRef.current===id)updateConfig(nextConfig);});},[mutate,updateConfig,updateOperations]);
  const toggleOperation = useCallback((id:string)=>mutate(()=>updateOperations((list)=>list.map((operation)=>operation.instanceId===id?{...operation,enabled:!operation.enabled}:operation))),[mutate,updateOperations]);
  const removeOperation = useCallback((id:string)=>mutate(()=>{updateOperations((list)=>list.filter((operation)=>operation.instanceId!==id).map((operation,index)=>({...operation,order:index})));if(selectedOperationRef.current===id){setSelectedOperation(null);updateConfig(toolDefaults(toolIdRef.current,outputRef.current));}}),[mutate,setSelectedOperation,updateConfig,updateOperations]);
  const duplicateOperation = useCallback((id:string)=>mutate(()=>{const source=operationsRef.current.find((operation)=>operation.instanceId===id);if(!source)return;const copy:Operation={...clone(source),instanceId:getId(),order:source.order+1};updateOperations((list)=>{const index=list.findIndex((operation)=>operation.instanceId===id);const next=[...list.slice(0,index+1),copy,...list.slice(index+1)];return next.map((operation,order)=>({...operation,order}));});setSelectedOperation(copy.instanceId);toolIdRef.current=copy.toolId;setToolId(copy.toolId);updateConfig({...copy.config,...outputRef.current});replaceToolRoute(copy.toolId);}),[mutate,replaceToolRoute,setSelectedOperation,updateConfig,updateOperations]);
  const moveOperation = useCallback((id:string,direction:number)=>mutate(()=>updateOperations((list)=>{const index=list.findIndex((operation)=>operation.instanceId===id),target=index+direction;if(index<0||target<0||target>=list.length)return list;const next=[...list];const [operation]=next.splice(index,1);next.splice(target,0,operation);return next.map((entry,order)=>({...entry,order}));})),[mutate,updateOperations]);
  const reorderOperation = useCallback((id:string,targetId:string)=>mutate(()=>updateOperations((list)=>{const from=list.findIndex((operation)=>operation.instanceId===id),to=list.findIndex((operation)=>operation.instanceId===targetId);if(from<0||to<0||from===to)return list;const next=[...list], [operation]=next.splice(from,1);next.splice(to,0,operation);return next.map((entry,order)=>({...entry,order}));})),[mutate,updateOperations]);
  const resetImage = useCallback(()=>{if(!operationsRef.current.length)return;mutate(()=>{updateOperations([]);setSelectedOperation(null);updateConfig(toolDefaults(toolIdRef.current,outputRef.current));});},[mutate,setSelectedOperation,updateConfig,updateOperations]);
  const capturePendingUpdateWorkspace = useCallback((targetUrl: string): PendingUpdateWorkspace => ({
    schema: 1,
    createdAt: Date.now(),
    targetUrl,
    workspaceId: routeRef.current.workspaceId,
    files: filesRef.current.map((file) => ({ id: file.id, file: file.file, name: file.name, size: file.size, type: file.type, width: file.width, height: file.height, status: file.status === "failed" ? "failed" : "ready", error: file.error, outputSize: file.outputSize, outputFormat: file.outputFormat })),
    active: activeRef.current,
    selected: selectedRef.current,
    toolId: toolIdRef.current,
    config: clone(configRef.current),
    output: { ...outputRef.current },
    operations: clone(operationsRef.current),
    selectedOperationId: selectedOperationRef.current,
    undo: clone(undoRef.current),
    redo: clone(redoRef.current),
    zoom: zoomRef.current,
    pan: { ...panRef.current },
    compare: compareRef.current,
    selectedMask: selectedMaskRef.current,
  }), []);
  const checkUpdates = useCallback(async () => {
    setUpdateState((state) => ({ ...state, status: "checking", message: undefined }));
    const remote = await checkForUpdates({ currentVersion: APP_VERSION, releaseUrl: APP_RELEASES_API_URL });
    let prepared: ServiceWorkerRegistration | null = null;
    try { prepared = await checkServiceWorkerUpdate(serviceWorkerRef.current); } catch {}
    const checkedAt = Date.now();
    if (remote.status === "current" || remote.status === "available") localStorage.setItem(updateCheckKey, String(checkedAt));
    const workerReady = Boolean(prepared ?? serviceWorkerRef.current?.waiting);
    const status: UpdateState["status"] = workerReady ? "available" : remote.status;
    const latest = remote.status === "current" || remote.status === "available" ? remote.latest : null;
    const message = remote.status === "error" ? remote.message : undefined;
    setUpdateState({ status, latest, workerReady, checkedAt, message });
    if (workerReady || remote.status === "available") {
      const noticeVersion = latest?.version ?? APP_VERSION;
      setUpdateNoticeDismissed(sessionStorage.getItem(updateNoticeKey) === noticeVersion);
    }
  }, []);
  const dismissUpdateNotice = useCallback(() => {
    const version = updateState.latest?.version ?? APP_VERSION;
    sessionStorage.setItem(updateNoticeKey, version);
    setUpdateNoticeDismissed(true);
  }, [updateState.latest?.version]);
  const applyUpdate = useCallback(async () => {
    if (processing) {
      setUpdateState((state) => ({ ...state, status: "error", message: "Finish the current export before applying an update." }));
      return;
    }
    const registration = serviceWorkerRef.current;
    if (!registration?.waiting) {
      setUpdateState((state) => ({ ...state, status: "error", message: "The update is not prepared yet. Check again in a moment." }));
      return;
    }
    setUpdateState((state) => ({ ...state, status: "applying", message: undefined }));
    const targetUrl = routeHref(toolIdRef.current, routeRef.current.workspaceId);
    await savePendingUpdateWorkspace(capturePendingUpdateWorkspace(targetUrl));
    const controllerChange = waitForServiceWorkerControllerChange();
    if (!activateServiceWorkerUpdate(registration)) {
      setUpdateState((state) => ({ ...state, status: "error", message: "The update could not be activated. Try again." }));
      return;
    }
    if (await controllerChange) window.location.assign(targetUrl);
    else setUpdateState((state) => ({ ...state, status: "error", message: "The update is still preparing. Try again shortly." }));
  }, [capturePendingUpdateWorkspace, processing]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>{try { const saved=localStorage.getItem(settingKey),favs=localStorage.getItem(favoriteKey),recent=localStorage.getItem(recentKey),history=localStorage.getItem(toolHistoryKey);if(saved)setSettings({...emptySettings,...JSON.parse(saved)});if(favs)setFavorites(JSON.parse(favs));if(recent)setRecents(JSON.parse(recent));if(history)setToolHistory(JSON.parse(history)); } catch {}},0);
    return()=>window.clearTimeout(timer);
  },[]);
  useEffect(()=>{
    let settingsFrame: number | null = null;
    const previous=appliedRouteRef.current;
    if(route.kind==="editor"){
      if(previous.kind!=="editor"||previous.workspaceId!==route.workspaceId)restoreWorkspace(route.workspaceId,route.toolId);
      else if(route.toolId!==toolIdRef.current)applyTool(route.toolId);
    } else if(route.kind==="settings") {
      if(previous.kind==="editor") rememberWorkspace(previous.workspaceId);
      settingsFrame=window.requestAnimationFrame(()=>{setSettingsSection(route.section);setSection("workspace");});
    } else if(previous.kind==="editor") rememberWorkspace(previous.workspaceId);
    appliedRouteRef.current=route;routeRef.current=route;
    return()=>{if(settingsFrame!==null)window.cancelAnimationFrame(settingsFrame);};
  },[applyTool,rememberWorkspace,restoreWorkspace,route]);
  useEffect(()=>{const onPop=()=>{const next=browserRoute();routeRef.current=next;setRoute(next);};window.addEventListener("popstate",onPop);return()=>window.removeEventListener("popstate",onPop);},[]);
  useEffect(()=>{const dark=settings.theme==="dark"||(settings.theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light";document.documentElement.dataset.density=settings.density;document.documentElement.classList.toggle("reduce-motion",settings.motion);},[settings]);
  useEffect(()=>{filesRef.current=files;},[files]);
  useEffect(()=>{activeRef.current=active;},[active]);
  useEffect(()=>{selectedRef.current=selected;},[selected]);
  useEffect(()=>{toolIdRef.current=toolId;},[toolId]);
  useEffect(()=>{undoRef.current=undo;},[undo]);
  useEffect(()=>{redoRef.current=redo;},[redo]);
  useEffect(()=>{zoomRef.current=zoom;},[zoom]);
  useEffect(()=>{panRef.current=pan;},[pan]);
  useEffect(()=>{compareRef.current=compare;},[compare]);
  useEffect(()=>{selectedMaskRef.current=selectedMask;},[selectedMask]);
  useEffect(()=>{previewFrameRef.current=previewFrame;},[previewFrame]);
  useEffect(()=>{const workspaceCache=workspacesRef.current,sourceCache=decodedSourcesRef.current;return()=>{const urls=new Set<string>();[...filesRef.current,...[...workspaceCache.values()].flatMap((workspace)=>workspace.files)].forEach((file)=>urls.add(file.url));urls.forEach((url)=>URL.revokeObjectURL(url));sourceCache.forEach((source)=>releaseImage(source));sourceCache.clear();};},[]);
  useEffect(()=>{let live=true;void registerImageLabServiceWorker((registration)=>{if(!live)return;serviceWorkerRef.current=registration;setUpdateState((state)=>({...state,workerReady:true,status:state.status==="idle"?"available":state.status}));}).then((registration)=>{if(live)serviceWorkerRef.current=registration;}).catch(()=>undefined);return()=>{live=false;};},[]);
  useEffect(()=>{let live=true;void consumePendingUpdateWorkspace().then((pending)=>{if(!live||!pending||restoredUpdateWorkspaceRef.current)return;restoredUpdateWorkspaceRef.current=true;const restoredFiles:Item[]=pending.files.map((file)=>({...file,url:URL.createObjectURL(file.file)}));const snapshot:WorkspaceSnapshot={files:restoredFiles,active:pending.active,selected:pending.selected,toolId:pending.toolId,config:pending.config,output:pending.output,operations:pending.operations,selectedOperationId:pending.selectedOperationId,undo:pending.undo,redo:pending.redo,zoom:pending.zoom,pan:pending.pan,compare:pending.compare,selectedMask:pending.selectedMask};workspacesRef.current.set(pending.workspaceId,snapshot);const currentRoute=routeRef.current;if(currentRoute.kind==="editor"&&currentRoute.workspaceId===pending.workspaceId)restoreWorkspace(pending.workspaceId,currentRoute.toolId);}).catch(()=>undefined);return()=>{live=false;};},[restoreWorkspace]);
  useEffect(()=>{const timer=window.setTimeout(()=>{try{setUpdateNoticeDismissed(sessionStorage.getItem(updateNoticeKey)===APP_VERSION);}catch{}},0);return()=>window.clearTimeout(timer);},[]);
  useEffect(()=>{if(!settings.autoUpdateChecks)return;const last=Number(localStorage.getItem(updateCheckKey)??0);if(Date.now()-last<6*60*60*1000)return;const timer=window.setTimeout(()=>void checkUpdates(),1100);return()=>window.clearTimeout(timer);},[checkUpdates,settings.autoUpdateChecks]);
  useEffect(()=>{if(!cancelProcess)return;return()=>cancelProcess();},[cancelProcess]);

  const dimensions = (file: File) => imageDimensions(file);
  const importFiles = useCallback(async (input: FileList | File[]) => {
    const valid=Array.from(input).filter((file)=>file.type.startsWith("image/")||/\.(png|jpe?g|webp|avif|gif|bmp|ico|svg)$/i.test(file.name));if(!valid.length)return;
    const pending=valid.map((file)=>({id:getId(),file,url:URL.createObjectURL(file),name:file.name,size:file.size,type:file.type||"image/*",status:"reading" as Status}));setFiles((list)=>[...list,...pending]);
    const resolved:Item[]=await Promise.all(pending.map(async(item)=>{try{return {...item,status:"ready" as Status,...await dimensions(item.file)};}catch(error){return {...item,status:"failed" as Status,error:error instanceof Error?error.message:"Could not decode this image."};}}));
    setFiles((list)=>list.map((item)=>resolved.find((newItem)=>newItem.id===item.id)??item));const first=resolved.find((item)=>item.status==="ready");if(first){setActive((value)=>value??first.id);if(routeRef.current.kind==="home")window.requestAnimationFrame(()=>{if(routeRef.current.kind==="home")navigateTool(toolIdRef.current);});};setSelected((value)=>[...new Set([...value,...resolved.filter((item)=>item.status==="ready").map((item)=>item.id)])]);
    setRecents((old)=>{const fresh=resolved.filter((item)=>item.status==="ready").map((item)=>({id:item.id,name:item.name,size:item.size,width:item.width,height:item.height,type:item.type,at:Date.now()}));const next=[...fresh,...old.filter((entry)=>!fresh.some((item)=>item.name===entry.name&&item.size===entry.size))].slice(0,18);localStorage.setItem(recentKey,JSON.stringify(next));return next;});
  },[navigateTool]);
  const selectTool = useCallback((id:string)=>navigateTool(id),[navigateTool]);
  const favorite = (id:string) => setFavorites((old)=>{const next=old.includes(id)?old.filter((value)=>value!==id):[...old,id];localStorage.setItem(favoriteKey,JSON.stringify(next));return next;});
  const input = (event: ChangeEvent<HTMLInputElement>) => { if(event.target.files)void importFiles(event.target.files);event.target.value=""; };
  const openPicker = () => { document.getElementById("image-picker")?.click(); };
  const updateCategoryEdges = useCallback((node = categoriesRef.current) => { if(!node)return;node.dataset.left=String(node.scrollLeft>2);node.dataset.right=String(node.scrollLeft+node.clientWidth<node.scrollWidth-2); },[]);
  const openContextMenu = useCallback((target:ContextTarget,x:number,y:number) => { const width=248,height=500;setContextMenu({target,x:Math.max(8,Math.min(x,window.innerWidth-width-8)),y:Math.max(8,Math.min(y,window.innerHeight-height-8))}); },[]);
  useEffect(()=>{
    const node=document.querySelector<HTMLDivElement>(".tool-sidebar .categories");
    categoriesRef.current=node;
    if(!node)return;
    const isButtonTarget=(target:EventTarget|null)=>target instanceof Node&&Array.from(node.querySelectorAll("button")).some((button)=>button.contains(target));
    const scrollActive=()=>{node.querySelector<HTMLButtonElement>("button.selected")?.scrollIntoView({block:"nearest",inline:"center",behavior:settings.motion?"auto":"smooth"});updateCategoryEdges(node);};
    const onScroll=()=>updateCategoryEdges(node);
    const onWheel=(event:WheelEvent)=>{if(node.scrollWidth<=node.clientWidth)return;const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;if(!delta)return;node.scrollLeft+=delta;updateCategoryEdges(node);event.preventDefault();};
    const onDown=(event:PointerEvent)=>{if(event.pointerType!=="mouse"||event.button!==0||isButtonTarget(event.target))return;categoryDrag.current={id:event.pointerId,x:event.clientX,scroll:node.scrollLeft,moved:false};node.setPointerCapture(event.pointerId);};
    const onMove=(event:PointerEvent)=>{const drag=categoryDrag.current;if(!drag||drag.id!==event.pointerId)return;const distance=event.clientX-drag.x;if(Math.abs(distance)>3){drag.moved=true;node.scrollLeft=drag.scroll-distance;updateCategoryEdges(node);event.preventDefault();}};
    const onEnd=(event:PointerEvent)=>{const drag=categoryDrag.current;if(!drag||drag.id!==event.pointerId)return;if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);if(drag.moved){suppressCategoryClick.current=true;window.setTimeout(()=>{suppressCategoryClick.current=false;},0);}categoryDrag.current=null;};
    const onClick=(event:MouseEvent)=>{if(!suppressCategoryClick.current)return;event.preventDefault();event.stopImmediatePropagation();suppressCategoryClick.current=false;};
    const observer=new ResizeObserver(scrollActive);
    observer.observe(node);
    node.addEventListener("wheel",onWheel,{passive:false});
    node.addEventListener("scroll",onScroll,{passive:true});
    node.addEventListener("pointerdown",onDown);
    node.addEventListener("pointermove",onMove);
    node.addEventListener("pointerup",onEnd);
    node.addEventListener("pointercancel",onEnd);
    node.addEventListener("click",onClick,true);
    scrollActive();
    return()=>{observer.disconnect();node.removeEventListener("wheel",onWheel);node.removeEventListener("scroll",onScroll);node.removeEventListener("pointerdown",onDown);node.removeEventListener("pointermove",onMove);node.removeEventListener("pointerup",onEnd);node.removeEventListener("pointercancel",onEnd);node.removeEventListener("click",onClick,true);};
  },[category,current?.id,settings.motion,updateCategoryEdges]);
  useEffect(()=>{
    const resolve=(target:EventTarget|null)=>{
      if(!(target instanceof Element))return null;
      const file=target.closest<HTMLElement>("[data-file-id]");
      if(file?.dataset.fileId)return{key:`file:${file.dataset.fileId}`,target:{kind:"file" as const,id:file.dataset.fileId}};
      const operation=target.closest<HTMLElement>("[data-operation-id]");
      if(operation?.dataset.operationId)return{key:`operation:${operation.dataset.operationId}`,target:{kind:"operation" as const,id:operation.dataset.operationId}};
      const row=target.closest<HTMLElement>(".tool-list .tool-row");
      const index=row?Array.from(document.querySelectorAll<HTMLElement>(".tool-list .tool-row")).indexOf(row):-1;
      const id=toolRowIds.current[index];
      if(id)return{key:`tool:${id}`,target:{kind:"tool" as const,id}};
      if(target.closest(".canvas-area"))return{key:"canvas",target:{kind:"canvas" as const}};
      return null;
    };
    const clear=()=>{if(longPress.current)window.clearTimeout(longPress.current.timer);longPress.current=null;};
    const onContext=(event:MouseEvent)=>{const item=resolve(event.target);if(!item)return;event.preventDefault();clear();openContextMenu(item.target,event.clientX,event.clientY);};
    const onDown=(event:PointerEvent)=>{if(event.pointerType!=="touch")return;const item=resolve(event.target);if(!item)return;clear();const state:LongPress={...item,timer:0,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};state.timer=window.setTimeout(()=>{if(longPress.current?.key!==state.key)return;suppressLongPressClick.current=state.key;openContextMenu(state.target,state.x,state.y);navigator.vibrate?.(8);},520);longPress.current=state;};
    const onMove=(event:PointerEvent)=>{const state=longPress.current;if(state&&Math.hypot(event.clientX-state.startX,event.clientY-state.startY)>12)clear();};
    const onEnd=()=>clear();
    const onClick=(event:MouseEvent)=>{const item=resolve(event.target);if(!item||suppressLongPressClick.current!==item.key)return;event.preventDefault();event.stopImmediatePropagation();suppressLongPressClick.current=null;};
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){clear();setContextMenu(null);}};
    document.addEventListener("contextmenu",onContext,true);
    document.addEventListener("pointerdown",onDown,true);
    document.addEventListener("pointermove",onMove,true);
    document.addEventListener("pointerup",onEnd,true);
    document.addEventListener("pointercancel",onEnd,true);
    document.addEventListener("click",onClick,true);
    document.addEventListener("keydown",onKey,true);
    return()=>{clear();document.removeEventListener("contextmenu",onContext,true);document.removeEventListener("pointerdown",onDown,true);document.removeEventListener("pointermove",onMove,true);document.removeEventListener("pointerup",onEnd,true);document.removeEventListener("pointercancel",onEnd,true);document.removeEventListener("click",onClick,true);document.removeEventListener("keydown",onKey,true);};
  },[openContextMenu]);

  const currentFile=current?.file;
  const currentStatus=current?.status;
  const sourceFor = useCallback(async (item:Item) => {
    const cached=decodedSourcesRef.current.get(item.id);
    if(cached)return cached;
    const decoded=await decodeImage(item.file);
    decodedSourcesRef.current.set(item.id,decoded);
    return decoded;
  },[]);
  const releaseSource = useCallback((id:string) => { const source=decodedSourcesRef.current.get(id);if(source)releaseImage(source);decodedSourcesRef.current.delete(id); },[]);
  useEffect(()=>{let alive=true;const abort=new AbortController();const currentId=current?.id;const hasVisibleFrame=Boolean(currentId&&previewFrameRef.current?.fileId===currentId);const timer=window.setTimeout(async()=>{if(!current||current.status!=="ready"){if(alive){setPreviewFrame(null);setSourceFrame(null);setPreviewInfo(null);setPreviewState("idle");}return;}if(!hasVisibleFrame)setPreviewState("working");try{const source=await sourceFor(current);if(!alive||abort.signal.aborted)return;setSourceFrame({fileId:current.id,source});const max=previewMode==="interactive"?Math.min(680,previewMax):previewMax;const canvas=await renderStack(source,operations,{max,signal:abort.signal});if(!alive||abort.signal.aborted)return;let bytes: number | undefined;if(previewMode==="full"){const result=await encode(canvas,output.format,output.quality,output.targetKB,abort.signal);bytes=result.blob.size;}if(!alive||abort.signal.aborted)return;setPreviewFrame({fileId:current.id,canvas});setPreviewInfo({width:canvas.width,height:canvas.height,bytes});setPreviewState("idle");}catch{if(alive&&!abort.signal.aborted)setPreviewState("error");}},previewMode==="interactive"?44:settings.motion?0:110);return()=>{alive=false;abort.abort();window.clearTimeout(timer);};},[current,currentFile,currentStatus,operations,output,previewMax,previewMode,settings.motion,sourceFor]);
  useEffect(()=>{if(tool.mode!=="palette"||!currentFile)return;let alive=true;const timer=window.setTimeout(()=>{setPaletteState("working");void palette(currentFile,paletteCount).then((value)=>{if(alive){setPaletteData(value);setPaletteState("idle");}}).catch(()=>alive&&setPaletteState("error"));},0);return()=>{alive=false;window.clearTimeout(timer);};},[currentFile,paletteCount,tool.mode]);
  useEffect(()=>{if(tool.mode!=="metadata"||!currentFile)return;let alive=true;const timer=window.setTimeout(()=>{setMetaState("working");void import("exifr").then((exifrModule)=>exifrModule.parse(currentFile,{exif:true,gps:true,tiff:true,translateValues:false,reviveValues:false})).then((value)=>{if(alive){setMetadata(value??{});setMetaState("idle");}}).catch(()=>{if(alive){setMetadata({});setMetaState("error");}});},0);return()=>{alive=false;window.clearTimeout(timer);};},[currentFile,tool.mode]);

  const point = (event: ReactPointerEvent<SVGSVGElement>) => { const rect=event.currentTarget.getBoundingClientRect();return{x:clamp((event.clientX-rect.left)/rect.width),y:clamp((event.clientY-rect.top)/rect.height)}; };
  const startMask = (event: ReactPointerEvent<SVGSVGElement>) => { if(tool.mode!=="privacy")return;const target=event.target as SVGElement,p=point(event),id=target.dataset.mask||target.dataset.handle,existing=config.masks.find((mask)=>mask.id===id);beforeMask.current=config;if(existing){drawRef.current={id:event.pointerId,mode:target.dataset.handle?"resize":"move",mask:existing,point:p};setSelectedMask(existing.id);}else{const mask:Mask={id:getId(),kind:tool.effect==="pixelate"?"pixelate":tool.effect==="redact"?"redact":"blur",x:p.x,y:p.y,width:.01,height:.01};patch({masks:[...config.masks,mask]});drawRef.current={id:event.pointerId,mode:"draw",mask,point:p};setSelectedMask(mask.id);}event.currentTarget.setPointerCapture(event.pointerId); };
  const moveMask = (event: ReactPointerEvent<SVGSVGElement>) => {const action=drawRef.current;if(!action||action.id!==event.pointerId||!action.mask)return;const p=point(event),mask=action.mask,dx=p.x-action.point.x,dy=p.y-action.point.y;patch({masks:configRef.current.masks.map((currentMask)=>{if(currentMask.id!==mask.id)return currentMask;if(action.mode==="draw")return{...currentMask,x:Math.min(action.point.x,p.x),y:Math.min(action.point.y,p.y),width:Math.max(.01,Math.abs(dx)),height:Math.max(.01,Math.abs(dy))};if(action.mode==="move")return{...currentMask,x:clamp(mask.x+dx,0,1-mask.width),y:clamp(mask.y+dy,0,1-mask.height)};return{...currentMask,width:clamp(mask.width+dx,.01,1-mask.x),height:clamp(mask.height+dy,.01,1-mask.y)};})});};
  const endMask = (event: ReactPointerEvent<SVGSVGElement>) => { if(drawRef.current?.id!==event.pointerId)return;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);commit();beforeMask.current=null;drawRef.current=null; };

  const process = async (items:Item[], zipped=false) => { const ready=items.filter((item)=>item.status==="ready");if(!ready.length)return;const abort=new AbortController(),activeOperations=clone(operationsRef.current),exportSettings={...outputRef.current};setCancelProcess(()=>()=>abort.abort());try{if(tool.mode==="grid"){setJob({phase:"processing",current:0,total:1,progress:15,text:"Building image grid"});const canvas=await grid(ready.map((item)=>item.file),configRef.current,abort.signal),result=await encode(canvas,exportSettings.format,exportSettings.quality,exportSettings.targetKB,abort.signal);download(result.blob,`imagelab-grid.${extension(result.format)}`);setJob({phase:"done",current:1,total:1,progress:100,text:"Grid exported"});return;}type ZipArchive={file:(name:string,data:Blob)=>void;generateAsync:(options:object,update?:(data:{percent:number})=>void)=>Promise<Blob>};let archive:ZipArchive|null=null;if(zipped){const jszipModule=await import("jszip"),Zip=(jszipModule.default??jszipModule) as unknown as new()=>ZipArchive;archive=new Zip();}setJob({phase:"processing",current:0,total:ready.length,progress:0,text:"Preparing export"});for(let index=0;index<ready.length;index++){const item=ready[index];if(abort.signal.aborted)throw new DOMException("Operation cancelled","AbortError");setFiles((list)=>list.map((entry)=>entry.id===item.id?{...entry,status:"processing",progress:12,error:undefined}:entry));setJob({phase:"processing",current:index,total:ready.length,progress:Math.round(index/ready.length*100),text:item.name});const canvas=await renderStack(item.file,activeOperations,{signal:abort.signal,stage:(stage)=>{const progress=stage.startsWith("Decoding")?22:stage.startsWith("Rendering")?56:82;setFiles((list)=>list.map((entry)=>entry.id===item.id?{...entry,progress}:entry));}});const result=await encode(canvas,exportSettings.format,exportSettings.quality,exportSettings.targetKB,abort.signal);const name=`${settings.naming==="original"?fileBase(item.name):`${fileBase(item.name)}-imagelab`}.${extension(result.format)}`;if(archive)archive.file(name,result.blob);else download(result.blob,name);setFiles((list)=>list.map((entry)=>entry.id===item.id?{...entry,status:"ready",progress:100,outputSize:result.blob.size,outputFormat:result.format}:entry));setJob({phase:"processing",current:index+1,total:ready.length,progress:Math.round((index+1)/ready.length*100),text:item.name});}if(archive){setJob({phase:"zipping",current:ready.length,total:ready.length,progress:0,text:"Preparing ZIP"});const blob=await archive.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}},(data:{percent:number})=>setJob({phase:"zipping",current:ready.length,total:ready.length,progress:Math.round(data.percent),text:"Preparing ZIP"}));if(abort.signal.aborted)throw new DOMException("Operation cancelled","AbortError");download(blob,"imagelab-export.zip");}setJob({phase:"done",current:ready.length,total:ready.length,progress:100,text:zipped?"ZIP downloaded":"Export ready"});}catch(error){const cancelled=error instanceof DOMException&&error.name==="AbortError";setFiles((list)=>list.map((item)=>item.status==="processing"?{...item,status:cancelled?"ready":"failed",progress:undefined,error:cancelled?undefined:"Could not process this image. Retry it inline."}:item));setJob({phase:cancelled?"cancelled":"failed",current:0,total:ready.length,progress:0,text:cancelled?"Export cancelled":error instanceof Error?error.message:"Export failed"});}finally{setCancelProcess(null);}};
  const remove = (id:string) => {const target=files.find((item)=>item.id===id);if(target)URL.revokeObjectURL(target.url);releaseSource(id);setFiles((list)=>list.filter((item)=>item.id!==id));setSelected((list)=>list.filter((value)=>value!==id));if(active===id)setActive(files.find((item)=>item.id!==id)?.id??null);};
  const retry = async (id:string) => {const item=files.find((file)=>file.id===id);if(!item)return;setFiles((list)=>list.map((file)=>file.id===id?{...file,status:"reading",error:undefined}:file));try{const size=await dimensions(item.file);setFiles((list)=>list.map((file)=>file.id===id?{...file,...size,status:"ready"}:file));}catch{setFiles((list)=>list.map((file)=>file.id===id?{...file,status:"failed",error:"Could not decode this image."}:file));}};
  const rename = (id:string) => {const item=files.find((file)=>file.id===id);if(item)setRenameDialog({id:item.id,value:item.name});};
  const saveRename = () => {if(!renameDialog)return;const name=renameDialog.value.trim();if(name)setFiles((list)=>list.map((file)=>file.id===renameDialog.id?{...file,name}:file));setRenameDialog(null);};
  const duplicate = (id:string) => {const item=files.find((file)=>file.id===id);if(!item)return;const match=item.name.match(/^(.*?)(\.[^.]+)?$/),name=`${match?.[1]??item.name} copy${match?.[2]??""}`,file=new File([item.file],name,{type:item.file.type,lastModified:item.file.lastModified}),copy:Item={...item,id:getId(),file,url:URL.createObjectURL(file),name,status:"ready",progress:undefined,error:undefined,outputSize:undefined,outputFormat:undefined};setFiles((list)=>{const index=list.findIndex((entry)=>entry.id===id);return index<0?[...list,copy]:[...list.slice(0,index+1),copy,...list.slice(index+1)];});setSelected((list)=>[...new Set([...list,copy.id])]);setActive(copy.id);};
  const copyItemImage = async (item:Item) => {try{const canvas=await renderStack(item.file,operationsRef.current,{max:2200}),result=await encode(canvas,"PNG",100,null);if("ClipboardItem" in window&&navigator.clipboard?.write){await navigator.clipboard.write([new ClipboardItem({[result.blob.type]:result.blob})]);setCopied("image");setTimeout(()=>setCopied(""),1200);}}catch{}};
  const copyImage = async () => {if(current)await copyItemImage(current);};
  const flattenEdits = async () => {if(!current||!operationsRef.current.length)return;try{const canvas=await renderStack(current.file,operationsRef.current),result=await encode(canvas,"PNG",100,null),name=`${fileBase(current.name)}-flattened.png`,file=new File([result.blob],name,{type:result.blob.type}),url=URL.createObjectURL(file),size=await dimensions(file);URL.revokeObjectURL(current.url);releaseSource(current.id);setFiles((list)=>list.map((item)=>item.id===current.id?{...item,file,url,name,size:file.size,type:file.type,...size,outputSize:undefined,outputFormat:undefined}:item));updateOperations([]);setSelectedOperation(null);updateConfig(toolDefaults(toolIdRef.current,outputRef.current));setUndo([]);setRedo([]);}catch{setJob({phase:"failed",current:0,total:0,progress:0,text:"Could not flatten the current edits."});}};
  const copy = async (value:string) => {try{await navigator.clipboard.writeText(value);setCopied(value);setTimeout(()=>setCopied(""),1100);}catch{}};
  const paste = async () => {try{if(!navigator.clipboard.read)return;const entries=await navigator.clipboard.read(),output:File[]=[];for(const item of entries){const type=item.types.find((value)=>value.startsWith("image/"));if(type)output.push(new File([await item.getType(type)],`pasted-${Date.now()}.${type.split("/")[1]}`,{type}));}if(output.length)await importFiles(output);}catch{}};

  useEffect(()=>{const keydown=(event:KeyboardEvent)=>{if(event.key===" ")setSpace(true);const modifier=event.ctrlKey||event.metaKey,undoShortcut=modifier&&event.key.toLowerCase()==="z"&&!event.shiftKey,redoShortcut=modifier&&(event.key.toLowerCase()==="y"||(event.key.toLowerCase()==="z"&&event.shiftKey));if(modifier&&event.key.toLowerCase()==="k"){event.preventDefault();setCommand(true);return;}if((event.target as HTMLElement)?.closest("input,textarea,select,[contenteditable='true']"))return;if(undoShortcut||redoShortcut){event.preventDefault();if(redoShortcut)redoEdit();else undoEdit();return;}if(event.key==="+")setZoom((value)=>Math.min(200,value+10));if(event.key==="-")setZoom((value)=>Math.max(25,value-10));if(event.key==="0"){setZoom(100);setPan({x:0,y:0});}if(event.key==="1"){setZoom(100);setPan({x:0,y:0});}if(event.key==="Delete"&&selectedMask){patch({masks:config.masks.filter((mask)=>mask.id!==selectedMask)},true);setSelectedMask(null);}if(event.key==="Escape"){setCommand(false);setCompare(false);setSelectedMask(null);}};const keyup=(event:KeyboardEvent)=>{if(event.key===" ")setSpace(false);};const clipboard=(event:ClipboardEvent)=>{if((event.target as HTMLElement)?.closest("input,textarea,select"))return;const incoming=[...(event.clipboardData?.items??[])].filter((item)=>item.type.startsWith("image/")).map((item)=>item.getAsFile()).filter((item):item is File=>Boolean(item));if(incoming.length){event.preventDefault();void importFiles(incoming);}};document.addEventListener("keydown",keydown);document.addEventListener("keyup",keyup);document.addEventListener("paste",clipboard);return()=>{document.removeEventListener("keydown",keydown);document.removeEventListener("keyup",keyup);document.removeEventListener("paste",clipboard);};},[config.masks,importFiles,patch,redoEdit,selectedMask,undoEdit]);

  const visible=useMemo(()=>tools.filter((item)=>{const cat=category==="All Tools"||category==="Favorites"&&favorites.includes(item.id)||category==="Recent"&&toolHistory.includes(item.id)||item.category===category;return cat&&(fuzzy(search,item.name)||fuzzy(search,item.description));}),[category,favorites,search,toolHistory]);
  useEffect(()=>{toolRowIds.current=visible.map((item)=>item.id);},[visible]);
  const settingsCommands=(query?searchSettings(query):[]).map((setting)=>({id:`setting:${setting.id}`,name:setting.title,description:`Settings → ${getSettingsSection(setting.section).title}`,icon:"sliders",run:()=>navigateSettings(setting.section,setting.id)}));
  const entries=[...settingsCommands,...tools.map((item)=>({id:`tool:${item.id}`,name:item.name,description:item.description,icon:item.icon,run:()=>selectTool(item.id)})).filter((entry)=>fuzzy(query,`${entry.name} ${entry.description}`)),{id:"import",name:"Import images",description:"Open local image files",icon:"thumb",run:openPicker},{id:"export",name:"Export image",description:"Export current local image",icon:"compress",run:()=>{if(current)void process([current]);}},{id:"settings",name:"Open Settings",description:"Appearance, privacy, and access",icon:"info",run:()=>navigateSettings("overview") }].filter((entry)=>entry.id.startsWith("setting:")||fuzzy(query,`${entry.name} ${entry.description}`));
  const selectedForExport=chosen.length?chosen:current?[current]:[];
  const panel=section==="settings"?<SettingsPanel settings={settings} setSettings={setSetting} clear={()=>{localStorage.removeItem(recentKey);setRecents([]);}}/>:tool.mode==="palette"?<PalettePanel state={paletteState} values={paletteData} count={paletteCount} setCount={setPaletteCount} copied={copied} copy={copy}/>:tool.mode==="metadata"?<MetadataPanel file={current} data={metadata} state={metaState} copied={copied} copy={copy}/>:<ToolPanel tool={tool} config={panelConfig} patch={patch} commit={commit} dimensions={current} clearMasks={()=>patch({masks:[]},true)} hasSelected={Boolean(selectedOperation)} resetSelected={()=>{if(selectedOperation)resetOperation(selectedOperation.instanceId);}}/>;
  const content=<>{panel}{section!=="settings"&&<AppliedEdits operations={operations} selectedId={selectedOperationId} onEdit={editOperation} onToggle={toggleOperation} onReset={resetOperation} onDuplicate={duplicateOperation} onRemove={removeOperation} onMove={moveOperation} onReorder={reorderOperation} onResetImage={resetImage} onMenu={(id,x,y)=>openContextMenu({kind:"operation",id},x,y)}/>}</>;
  const contextTarget = contextMenu?.target;
  const contextItems: MenuAction[] = contextTarget?.kind === "tool" ? (() => {
    const item = getTool(contextTarget.id);
    return [
      { id: "open", label: "Open tool", icon: FileImage, run: () => selectTool(item.id) },
      { id: "favorite", label: favorites.includes(item.id) ? "Remove favorite" : "Add to favorites", icon: Star, run: () => favorite(item.id) },
      { id: "separator", separator: true },
      { id: "workspace", label: "Open in new workspace", icon: Plus, run: () => window.open(routeHref(item.id, `workspace-${getId()}`), "_blank", "noopener,noreferrer") },
    ];
  })() : contextTarget?.kind === "file" ? (() => {
    const item = files.find((file) => file.id === contextTarget.id);
    if (!item) return [];
    const unavailable = item.status !== "ready" || processing;
    return [
      { id: "open", label: "Open", icon: FileImage, run: () => { setActive(item.id); setSection("workspace"); } },
      { id: "rename", label: "Rename", icon: Command, run: () => rename(item.id) },
      { id: "duplicate", label: "Duplicate", icon: Layers3, run: () => duplicate(item.id) },
      { id: "separator", separator: true },
      { id: "copy", label: "Copy image", icon: Copy, disabled: unavailable || typeof ClipboardItem === "undefined" || !navigator.clipboard?.write, run: () => void copyItemImage(item) },
      { id: "export", label: "Download", icon: Download, disabled: unavailable, run: () => void process([item]) },
      { id: "info", label: "Show image information", icon: Info, run: () => { setActive(item.id); selectTool("metadata"); } },
      { id: "separator-delete", separator: true },
      { id: "remove", label: "Remove from workspace", icon: Trash2, tone: "danger", run: () => remove(item.id) },
    ];
  })() : contextTarget?.kind === "operation" ? (() => {
    const operation = operations.find((entry) => entry.instanceId === contextTarget.id);
    if (!operation) return [];
    const index = operations.findIndex((entry) => entry.instanceId === operation.instanceId);
    const name = getTool(operation.toolId).name;
    return [
      { id: "edit", label: `Edit ${name}`, icon: SlidersHorizontal, run: () => editOperation(operation.instanceId) },
      { id: "toggle", label: operation.enabled ? `Disable ${name}` : `Enable ${name}`, icon: operation.enabled ? EyeOff : Eye, run: () => toggleOperation(operation.instanceId) },
      { id: "reset", label: `Reset ${name}`, icon: RotateCcw, run: () => resetOperation(operation.instanceId) },
      { id: "duplicate", label: "Duplicate", icon: CopyPlus, run: () => duplicateOperation(operation.instanceId) },
      { id: "separator", separator: true },
      { id: "up", label: "Move up", icon: ArrowUp, disabled: index === 0, run: () => moveOperation(operation.instanceId, -1) },
      { id: "down", label: "Move down", icon: ArrowDown, disabled: index === operations.length - 1, run: () => moveOperation(operation.instanceId, 1) },
      { id: "separator-delete", separator: true },
      { id: "remove", label: `Remove ${name}`, icon: Trash2, tone: "danger", run: () => removeOperation(operation.instanceId) },
    ];
  })() : contextTarget?.kind === "canvas" ? [
    { id: "undo", label: "Undo", icon: Undo2, disabled: !undo.length, run: undoEdit },
    { id: "redo", label: "Redo", icon: Redo2, disabled: !redo.length, run: redoEdit },
    { id: "separator-view", separator: true },
    { id: "fit", label: "Fit to screen", icon: Move, run: () => { setZoom(100); setPan({ x: 0, y: 0 }); } },
    { id: "actual", label: "Actual size", icon: ZoomIn, run: () => { setZoom(100); setPan({ x: 0, y: 0 }); } },
    { id: "separator-export", separator: true },
    { id: "copy", label: "Copy image", icon: Copy, disabled: !current || processing || typeof ClipboardItem === "undefined", run: () => void copyImage() },
    { id: "export", label: "Export image", icon: Download, disabled: !current || processing, run: () => current && void process([current]) },
    { id: "info", label: "Show image information", icon: Info, run: () => selectTool("metadata") },
    { id: "separator-reset", separator: true },
    { id: "reset", label: "Reset image", icon: RotateCcw, disabled: !operations.length, run: resetImage },
    { id: "remove-effects", label: "Remove all effects", icon: Trash2, tone: "danger", disabled: !operations.length, run: resetImage },
    { id: "flatten", label: "Flatten edits", icon: Layers3, disabled: !operations.length, run: () => void flattenEdits() },
  ] : [];

  const onSheetPointerDown = (event:ReactPointerEvent<HTMLButtonElement>) => { if(window.innerWidth>720)return;sheetDrag.current={id:event.pointerId,y:event.clientY,state:sheetState,moved:false};event.currentTarget.setPointerCapture(event.pointerId); };
  const onSheetPointerMove = (event:ReactPointerEvent<HTMLButtonElement>) => { const drag=sheetDrag.current;if(!drag||drag.id!==event.pointerId)return;const delta=event.clientY-drag.y;if(Math.abs(delta)>12)drag.moved=true; };
  const onSheetPointerUp = (event:ReactPointerEvent<HTMLButtonElement>) => { const drag=sheetDrag.current;if(!drag||drag.id!==event.pointerId)return;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);const delta=event.clientY-drag.y;if(Math.abs(delta)>16){suppressSheetClick.current=true;setSheetState(delta>55?"collapsed":delta<-55?"expanded":"medium");window.setTimeout(()=>{suppressSheetClick.current=false;},0);}sheetDrag.current=null; };
  const toggleSheet = () => { if(suppressSheetClick.current)return;setSheetState((value)=>value==="collapsed"?"medium":value==="medium"?"expanded":"collapsed"); };

  return <div className="app" onDragEnter={(event)=>{event.preventDefault();dragDepth.current++;setDropping(true);}} onDragLeave={(event)=>{event.preventDefault();dragDepth.current--;if(dragDepth.current<=0){dragDepth.current=0;setDropping(false);}}} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();dragDepth.current=0;setDropping(false);if(event.dataTransfer.files.length)void importFiles(event.dataTransfer.files);}}>
    <input id="image-picker" type="file" className="sr-only" accept={accept} multiple onChange={input}/>
    <header className="topbar">
      <button className="brand" onClick={navigateHome}><PixelLogo/><span>ImageLab</span></button>
      <nav>{(["workspace","tools","recent","settings"] as Section[]).map((name)=><button key={name} className={(name==="workspace"?editorOpen&&section!=="settings":name==="settings"?route.kind==="settings":section===name)?"active":""} onClick={()=>name==="workspace"?(editorOpen?setSection("workspace"):navigateTool(toolId)):name==="settings"?navigateSettings("overview"):setSection(name)}>{name[0].toUpperCase()+name.slice(1)}</button>)}</nav>
      <div className="top-actions"><button className="command-trigger" onClick={()=>setCommand(true)}><Search size={15}/><span>Search tools</span><kbd>⌘ K</kbd></button><div className="themes"><button className={settings.theme==="light"?"active":""} onClick={()=>setSetting({...settings,theme:"light"})} aria-label="Light theme"><Sun size={14}/></button><button className={settings.theme==="dark"?"active":""} onClick={()=>setSetting({...settings,theme:"dark"})} aria-label="Dark theme"><Moon size={14}/></button><button className={settings.theme==="system"?"active":""} onClick={()=>setSetting({...settings,theme:"system"})} aria-label="System theme"><Sun size={14}/></button></div><IconButton label="Import images" onClick={openPicker}><Plus size={18}/></IconButton></div>
    </header>
    {route.kind==="settings"?<SettingsExperience section={settingsSection} search={settingsSearch} setSearch={setSettingsSearch} focusId={settingsFocusId} clearFocus={clearSettingsFocus} settings={settings} setSettings={setSetting} clear={()=>{localStorage.removeItem(recentKey);setRecents([]);}} onSection={(next,focus)=>navigateSettings(next,focus)} onBack={()=>navigateTool(toolIdRef.current,{workspace:route.workspaceId})} updateState={updateState} checkUpdates={checkUpdates} applyUpdate={applyUpdate} dismissUpdate={dismissUpdateNotice}/>:!editorOpen?<Welcome favorites={favorites} recents={recents} paste={paste} choose={selectTool}/>:<div className="shell">
      <aside className={`tool-sidebar ${section==="tools"?"open":""}`}><div className="side-title"><b>Tools</b><IconButton label="Close tools" onClick={()=>setSection("workspace")}><X size={15}/></IconButton></div><label className="search"><Search size={14}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search tools"/></label><div className="categories">{categories.map((name)=><button key={name} className={category===name?"selected":""} onClick={()=>setCategory(name)}>{name}</button>)}</div><div className="tool-list">{visible.map((item)=><div className={`tool-row ${item.id===tool.id?"selected":""}`} key={item.id}><button className="tool-main" onClick={()=>selectTool(item.id)}><span><Icon name={item.icon} size={15}/></span><div><b>{item.name}</b><small>{item.description}</small></div></button><button className={`star ${favorites.includes(item.id)?"selected":""}`} onClick={()=>favorite(item.id)} aria-label="Favorite tool"><Star size={13} fill={favorites.includes(item.id)?"currentColor":"none"}/></button></div>)}</div></aside>
      <main className="workspace">
        <div className="workspace-title"><div><small>{tool.category}</small><h1>{tool.name}</h1><p>{tool.description}</p></div><div><button className="tool-mobile" onClick={()=>setSection("tools")}><Wand2 size={14}/> Tools</button><button className="fav-current" onClick={()=>favorite(tool.id)}><Star size={14} fill={favorites.includes(tool.id)?"currentColor":"none"}/>{favorites.includes(tool.id)?"Saved":"Favorite"}</button></div></div>
        <section className="canvas-stage">
          <div className="canvas-area">
            {!current?<EditorEmpty tool={tool} browse={openPicker} paste={paste}/>:<>
              {previewState==="working"&&previewFrame?.fileId!==current.id&&<div className="canvas-loading"><i/><i/><i/></div>}
              <div className={`media ${space?"grab":""}`} style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom/100})`}} onPointerDown={(event)=>{if(space){event.currentTarget.setPointerCapture(event.pointerId);setPanning({id:event.pointerId,x:event.clientX,y:event.clientY,origin:pan});}}} onPointerMove={(event)=>{if(panning?.id===event.pointerId)setPan({x:panning.origin.x+event.clientX-panning.x,y:panning.origin.y+event.clientY-panning.y});}} onPointerUp={(event)=>panning?.id===event.pointerId&&setPanning(null)}><PersistentPreview file={current} sourceFrame={sourceFrame} previewFrame={previewFrame} compare={compare}/>{tool.mode==="privacy"&&!compare&&<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="mask-layer" onPointerDown={startMask} onPointerMove={moveMask} onPointerUp={endMask} onPointerCancel={endMask}>{config.masks.map((mask)=><g key={mask.id}><rect data-mask={mask.id} className={selectedMask===mask.id?"selected":""} x={mask.x*1000} y={mask.y*1000} width={mask.width*1000} height={mask.height*1000}/><circle data-handle={mask.id} cx={(mask.x+mask.width)*1000} cy={(mask.y+mask.height)*1000} r="13"/></g>)}</svg>}</div>
              {previewState==="working"&&previewFrame?.fileId===current.id&&<span className="canvas-inline-status">Updating preview</span>}
              {previewState==="error"&&<div className="canvas-error">Could not render preview. <button onClick={()=>patch({},true)}>Retry</button></div>}
            </>}
          </div>
          <div className="canvas-controls"><div><IconButton label="Zoom out" onClick={()=>setZoom((value)=>Math.max(25,value-10))}><ZoomOut size={15}/></IconButton><span>{zoom}%</span><IconButton label="Zoom in" onClick={()=>setZoom((value)=>Math.min(200,value+10))}><ZoomIn size={15}/></IconButton></div><div><button onClick={()=>{setZoom(100);setPan({x:0,y:0});}}>Fit <kbd>0</kbd></button><button disabled={!current} onPointerDown={()=>setCompare(true)} onPointerUp={()=>setCompare(false)} onPointerLeave={()=>setCompare(false)}><Eye size={14}/> Hold to compare</button></div><div><IconButton label="Undo" disabled={!undo.length} onClick={undoEdit}><Undo2 size={15}/></IconButton><IconButton label="Redo" disabled={!redo.length} onClick={redoEdit}><Redo2 size={15}/></IconButton></div></div>
        </section>
        <Queue files={files} active={current?.id ?? ""} selected={selected} onActive={setActive} onToggle={(id)=>setSelected((items)=>items.includes(id)?items.filter((value)=>value!==id):[...items,id])} retry={retry} browse={openPicker} onMenu={(id,x,y)=>openContextMenu({kind:"file",id},x,y)}/>
      </main>
      <aside className={`context sheet-${sheetState}`}><button className="sheet-handle" type="button" aria-label="Resize editing panel" aria-expanded={sheetState!=="collapsed"} onPointerDown={onSheetPointerDown} onPointerMove={onSheetPointerMove} onPointerUp={onSheetPointerUp} onPointerCancel={onSheetPointerUp} onClick={toggleSheet}><i/><span>{section==="settings"?"Settings":tool.name}</span><ChevronDown size={15}/></button><div className="context-scroll">{content}</div>{section!=="settings"&&(current?<Export current={current} config={panelConfig} preview={previewInfo} job={job} selected={selectedForExport.length} processing={processing} exportCurrent={()=>void process(selectedForExport)} exportAll={()=>void process(files)} zip={()=>void process(selectedForExport,true)} cancel={()=>cancelProcess?.()} copy={copyImage} copied={copied==="image"}/>:<EmptyExport config={panelConfig}/>)}</aside>
    </div>}
    {dropping&&<div className="drop-zone"><div><PixelLogo/><b>Drop images to start</b><span>Import one image or a batch</span></div></div>}
    {command&&<Commands query={query} setQuery={setQuery} entries={entries} close={()=>{setCommand(false);setQuery("");}}/>}
    {updateState.workerReady&&!updateNoticeDismissed&&updateState.status!=="applying"&&<aside className="update-notice" role="status"><span><b>{updateState.latest ? `ImageLab ${updateState.latest.version} is ready.` : "A refreshed ImageLab build is ready."}</b><small>Update when you are ready; your workspace is preserved locally.</small></span><button type="button" onClick={()=>void applyUpdate()} disabled={processing}>Update</button><button type="button" onClick={dismissUpdateNotice}>Later</button></aside>}
    <ImageLabContextMenu menu={contextMenu} items={contextItems} close={()=>setContextMenu(null)}/>
    {renameDialog&&<ImageLabDialog title="Rename image" description="Change the workspace label without modifying the local file." onClose={()=>setRenameDialog(null)}><label className="dialog-field"><span>File name</span><input autoFocus value={renameDialog.value} onChange={(event)=>setRenameDialog({...renameDialog,value:event.target.value})} onKeyDown={(event)=>{if(event.key==="Enter")saveRename();}}/></label><footer className="dialog-actions"><Button onClick={()=>setRenameDialog(null)}>Cancel</Button><Button className="primary" onClick={saveRename}>Save name</Button></footer></ImageLabDialog>}
  </div>;
}

function Welcome({favorites,recents,paste,choose}:{favorites:string[];recents:Recent[];paste:()=>void;choose:(id:string)=>void}) {
  const [expanded,setExpanded]=useState(false);
  const allToolsRef=useRef<HTMLElement | null>(null);
  const toggleAllTools=()=>{const next=!expanded;setExpanded(next);if(!next)window.requestAnimationFrame(()=>allToolsRef.current?.scrollIntoView({block:"nearest",behavior:"smooth"}));};
  const quick=["compress","resize","convert","pixelate","palette","metadata"].map(getTool),faved=tools.filter((item)=>favorites.includes(item.id));
  return <main className="welcome"><section className="intro"><span className="eyebrow"><PixelLogo/>Local image toolkit</span><h1>What do you want to do with your image?</h1><p>Import a file to edit, transform, inspect, and export it without sending it anywhere.</p><div className="import-box"><span><Upload size={23}/></span><b>Drop images here</b><em>or choose files from your device</em><div><label htmlFor="image-picker"><FolderOpen size={15}/>Browse</label><button className="quiet" onClick={paste}><ClipboardPaste size={15}/>Paste</button></div><small>PNG, JPEG, WebP, AVIF, GIF, BMP, ICO, SVG · Multiple files supported</small></div></section><section className="welcome-grid"><List title="Recent tools" hint="Jump back in" values={quick} choose={choose}/><List title="Favorites" hint={faved.length?"Saved locally":"Save tools with the star"} values={faved} choose={choose}/></section><section className="welcome-lower"><section className="all-tools-section" ref={allToolsRef}><header><h2>All tools</h2></header><div className={`directory tool-directory ${expanded?"expanded":"collapsed"}`} aria-expanded={expanded}>{tools.map((item)=><button key={item.id} onClick={()=>choose(item.id)}><Icon name={item.icon} size={14}/>{item.name}</button>)}</div><button className="show-tools" type="button" aria-expanded={expanded} onClick={toggleAllTools}>{expanded?"Show less":"Show more"}<ChevronDown size={14}/></button></section><div><header><h2>Recent files</h2><span>Stored on this device</span></header>{recents.length?<div className="recent-files">{recents.slice(0,4).map((item)=><div key={item.id}><FileImage size={15}/><span><b>{item.name}</b><small>{displayDimensions(item.width,item.height)} · {formatBytes(item.size)}</small></span></div>)}</div>:<p className="quiet-copy">Imported file details appear here. Full image copies remain optional.</p>}</div></section><footer>Images are processed locally in your browser during normal editing operations. <span>Open source, offline-friendly, and built for focused workflows.</span></footer></main>;
}
export function List({title,hint,values,choose}:{title:string;hint:string;values:Tool[];choose:(id:string)=>void}){return <div><header><h2>{title}</h2><span>{hint}</span></header>{values.length?<div className="quick-list">{values.map((item)=><button key={item.id} onClick={()=>choose(item.id)}><i><Icon name={item.icon}/></i><span><b>{item.name}</b><small>{item.description}</small></span><ChevronRight size={14}/></button>)}</div>:<p className="quiet-copy">Your favorite tools will appear here.</p>}</div>}

export function EditorEmpty({tool,browse,paste}:{tool:Tool;browse:()=>void;paste:()=>void}) { return <div className="editor-empty"><small>{tool.category}</small><span><Plus size={20}/></span><h2>Click to add an image</h2><p>Paste, browse, or drag an image into the workspace.</p><div><Button className="primary" onClick={browse}><FolderOpen size={14}/>Browse</Button><Button onClick={paste}><ClipboardPaste size={14}/>Paste</Button></div></div>; }
function EmptyExport({config}:{config:Config}) { return <section className="export empty-export"><hr/><header><h3>Export</h3></header><p>Add an image to enable a {config.format} export.</p><Button className="primary export-main" disabled><ArrowDownToLine size={16}/>Export image</Button></section>; }

export function Queue({files,active,selected,onActive,onToggle,retry,browse,onMenu}:{files:Item[];active:string;selected:string[];onActive:(id:string)=>void;onToggle:(id:string)=>void;retry:(id:string)=>void;browse:()=>void;onMenu:(id:string,x:number,y:number)=>void}) {
  const [collapsed,setCollapsed] = useState(false);
  return <section className={`queue ${collapsed?"collapsed":""}`} aria-label="Workspace files">
    <header>
      <div><b>Files <em>{files.length}</em></b><span>{selected.length} selected · {files.length} total</span></div>
      <button className="strip-toggle" onClick={()=>setCollapsed((value)=>!value)} aria-expanded={!collapsed}><ChevronRight size={13}/>{collapsed?"Show":"Hide"}</button>
    </header>
    {!collapsed&&<div className="file-strip-scroll" role="list" aria-label="Files in workspace">
      {files.map((file)=><article className={file.id===active?"active":""} data-file-id={file.id} key={file.id} role="listitem" tabIndex={0} onClick={()=>onActive(file.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onActive(file.id);}}}>
        <ImageLabCheckbox label={`Select ${file.name}`} checked={selected.includes(file.id)} onChange={()=>onToggle(file.id)}/>
        <img src={file.url} alt=""/>
        <span><b>{file.name}</b><small>{displayDimensions(file.width,file.height)} · {formatBytes(file.size)}{file.outputSize&&<> → {formatBytes(file.outputSize)}</>}</small>{file.status==="reading"&&<em className="indeterminate">Reading file</em>}{file.status==="processing"&&<em className="queue-progress"><ImageLabProgress value={file.progress??0} label={`Processing ${file.name}`}/>{file.progress??0}%</em>}{file.status==="failed"&&<em className="failed">{file.error} <button onClick={(event)=>{event.stopPropagation();retry(file.id);}}>Retry</button></em>}</span>
        <button className="row-menu" onClick={(event)=>{event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();onMenu(file.id,event.clientX||rect.right,event.clientY||rect.bottom);}} aria-label={`Actions for ${file.name}`}><MoreHorizontal size={14}/></button>
      </article>)}
      <button className="queue-add" type="button" onClick={browse}><Plus size={16}/><span>Add image</span></button>
    </div>}
  </section>
}

export function ImageLabContextMenu({menu,items,close}:{menu:ContextState;items:MenuAction[];close:()=>void}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(()=>{if(!menu)return;const frame=window.requestAnimationFrame(()=>menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());return()=>window.cancelAnimationFrame(frame);},[menu]);
  if(!menu||!items.length)return null;
  const moveFocus=(event:ReactKeyboardEvent<HTMLDivElement>,direction:number)=>{if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));if(!buttons.length)return;const current=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==="Home"?0:event.key==="End"?buttons.length-1:(current+direction+buttons.length)%buttons.length;buttons[next]?.focus();};
  const title=menu.target.kind==="file"?"Image actions":menu.target.kind==="canvas"?"Canvas actions":menu.target.kind==="operation"?"Edit actions":"Tool actions";
  return <div className="context-menu-layer" onPointerDown={close}><div className="context-menu" ref={menuRef} role="menu" aria-label={title} style={{left:menu.x,top:menu.y}} onPointerDown={(event)=>event.stopPropagation()} onKeyDown={(event)=>{if(event.key==="Escape"){event.preventDefault();close();return;}moveFocus(event,event.key==="ArrowUp"?-1:1);}}><span className="context-menu-title">{title}</span>{items.map((item)=>{if("separator" in item)return <div className="menu-separator" key={item.id} role="separator"/>;const ActionIcon=item.icon;return <button key={item.id} role="menuitem" className={item.tone??""} disabled={item.disabled} onClick={()=>{item.run();close();}}><ActionIcon size={15}/><span>{item.label}</span>{item.disabled&&<small>Unavailable</small>}</button>;})}</div></div>;
}

export function ImageLabDialog({title,description,children,onClose}:{title:string;description?:string;children:ReactNode;onClose:()=>void}) {
  const dialogRef=useRef<HTMLElement | null>(null);
  useEffect(()=>{const frame=window.requestAnimationFrame(()=>dialogRef.current?.querySelector<HTMLElement>("input,button,textarea,[tabindex]:not([tabindex='-1'])")?.focus());const keydown=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();onClose();return;}if(event.key!=="Tab")return;const focusable=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])")??[]);if(!focusable.length)return;const index=focusable.indexOf(document.activeElement as HTMLElement);if(event.shiftKey&&index<=0){event.preventDefault();focusable.at(-1)?.focus();}else if(!event.shiftKey&&index===focusable.length-1){event.preventDefault();focusable[0]?.focus();}};document.addEventListener("keydown",keydown);return()=>{window.cancelAnimationFrame(frame);document.removeEventListener("keydown",keydown);};},[onClose]);
  return <div className="il-dialog-backdrop" onPointerDown={onClose}><section ref={dialogRef} className="il-dialog" role="dialog" aria-modal="true" aria-labelledby="il-dialog-title" onPointerDown={(event)=>event.stopPropagation()}><header><div><h2 id="il-dialog-title">{title}</h2>{description&&<p>{description}</p>}</div><IconButton label="Close dialog" onClick={onClose}><X size={16}/></IconButton></header>{children}</section></div>;
}

function ToolPanel({tool,config,patch,commit,dimensions,clearMasks,resetSelected,hasSelected}:{tool:Tool;config:Config;patch:(value:Partial<Config>,record?:boolean)=>void;commit:()=>void;dimensions:Item|null;clearMasks:()=>void;resetSelected:()=>void;hasSelected:boolean}) { const group=(body:ReactNode)=><section className="panel"><div className="panel-heading"><h3>{tool.name}</h3>{hasSelected&&<ImageLabTooltip label={`Reset ${tool.name}`}><button className="panel-reset" type="button" aria-label={`Reset ${tool.name}`} onClick={resetSelected}><RotateCcw size={13}/></button></ImageLabTooltip>}</div>{body}</section>;const format=(value:string)=>patch({format:value as Format},true); if(tool.mode==="compress")return group(<><div className="two"><label>Format<ImageLabSelect label="Format" value={config.format} options={["PNG","JPEG","WebP","AVIF","BMP","ICO"].map((value)=>({value,label:value}))} onChange={format}/></label><label>Quality<ImageLabNumberInput label="Quality" min={1} max={100} value={config.quality} defaultValue={82} onChange={(value)=>patch({quality:clamp(value??82,1,100)})} onCommit={commit}/></label></div>{!(["PNG","BMP","ICO"] as Format[]).includes(config.format)&&<Slider label="Quality" value={config.quality} min={10} max={100} unit="%" defaultValue={82} onChange={(value)=>patch({quality:value})} onCommit={commit}/>}<label className="input-label">Target file size <ImageLabNumberInput label="Target file size" min={1} value={config.targetKB} placeholder="Optional" unit="KB" defaultValue={null} onChange={(value)=>patch({targetKB:value})} onCommit={commit}/></label><ImageLabDisclosure label="Advanced"><p>Canvas exports intentionally remove embedded metadata. AVIF support depends on the active browser.</p></ImageLabDisclosure></>);
 if(tool.mode==="resize")return group(<><div className="two"><label>Width<ImageLabNumberInput label="Width" min={1} value={config.width} placeholder={String(dimensions?.width??"Auto")} onChange={(value)=>{const width=Math.max(1,value??1),ratio=dimensions?.width&&dimensions.height?dimensions.height/dimensions.width:1;patch({width,height:config.lockAspect?Math.round(width*ratio):config.height});}} onCommit={commit}/></label><label>Height<ImageLabNumberInput label="Height" min={1} value={config.height} placeholder={String(dimensions?.height??"Auto")} onChange={(value)=>{const height=Math.max(1,value??1),ratio=dimensions?.width&&dimensions.height?dimensions.width/dimensions.height:1;patch({height,width:config.lockAspect?Math.round(height*ratio):config.width});}} onCommit={commit}/></label></div><Toggle label="Keep aspect ratio" value={config.lockAspect} onChange={(value)=>patch({lockAspect:value},true)}/><div className="presets"><button onClick={()=>patch({width:1280,height:720,aspect:"16:9"},true)}>YouTube thumbnail</button><button onClick={()=>patch({width:1080,height:1080,aspect:"1:1"},true)}>Instagram post</button><button onClick={()=>patch({width:1080,height:1920,aspect:"9:16"},true)}>Story / TikTok</button><button onClick={()=>patch({width:512,height:512,aspect:"1:1"},true)}>Profile picture</button></div></>);
 if(tool.mode==="crop")return group(<><div className="segmented">{(["free","1:1","4:3","3:2","16:9","9:16","21:9"] as Config["aspect"][]).map((value)=><button key={value} className={config.aspect===value?"selected":""} onClick={()=>patch({aspect:value},true)}>{value==="free"?"Free":value}</button>)}</div><Slider label="Zoom" value={config.cropZoom} min={1} max={3} step={.01} unit="×" onChange={(value)=>patch({cropZoom:value})} onCommit={commit}/><Slider label="Horizontal position" value={Math.round(config.cropX*100)} min={0} max={100} unit="%" onChange={(value)=>patch({cropX:value/100})} onCommit={commit}/><Slider label="Vertical position" value={Math.round(config.cropY*100)} min={0} max={100} unit="%" onChange={(value)=>patch({cropY:value/100})} onCommit={commit}/></>);
 if(tool.mode==="rotate")return group(<><div className="presets"><button onClick={()=>patch({rotation:(config.rotation+270)%360},true)}><RotateCcw size={14}/>Rotate left</button><button onClick={()=>patch({rotation:(config.rotation+90)%360},true)}><RotateCw size={14}/>Rotate right</button><button onClick={()=>patch({flipX:!config.flipX},true)}>↔ Flip horizontal</button><button onClick={()=>patch({flipY:!config.flipY},true)}>↕ Flip vertical</button></div><Slider label="Fine rotation" value={config.rotation} min={0} max={359} unit="°" onChange={(value)=>patch({rotation:value})} onCommit={commit}/></>);
 if(tool.mode==="padding")return group(<><Slider label="Padding" value={config.padding} min={0} max={300} unit=" px" onChange={(value)=>patch({padding:value})} onCommit={commit}/><Color label="Canvas color" value={config.paddingColor} onChange={(value)=>patch({paddingColor:value},true)}/></>);
 if(tool.mode==="effect"){const effect=tool.effect;const control=effect==="pixelate"?<Slider label="Pixel size" value={config.pixelSize} min={2} max={80} unit=" px" defaultValue={12} onChange={(value)=>patch({pixelSize:value})} onCommit={commit}/>:effect==="blur"?<Slider label="Blur radius" value={config.blur} min={0} max={32} unit=" px" defaultValue={4} onChange={(value)=>patch({blur:value})} onCommit={commit}/>:effect==="sharpen"?<Slider label="Strength" value={config.sharpen} min={0} max={1} step={.05} defaultValue={.45} onChange={(value)=>patch({sharpen:value})} onCommit={commit}/>:effect==="posterize"?<Slider label="Color levels" value={config.posterize} min={2} max={12} defaultValue={5} onChange={(value)=>patch({posterize:value})} onCommit={commit}/>:effect==="threshold"?<Slider label="Threshold" value={config.threshold} min={0} max={255} defaultValue={128} onChange={(value)=>patch({threshold:value})} onCommit={commit}/>:effect==="duotone"?<><Color label="Dark tone" value={config.dark} onChange={(value)=>patch({dark:value},true)}/><Color label="Light tone" value={config.light} onChange={(value)=>patch({light:value},true)}/></>:["sepia","grain","vignette","scanlines","reflection"].includes(effect??"")?<Slider label="Amount" value={config.amount} min={0} max={100} unit="%" defaultValue={35} onChange={(value)=>patch({amount:value})} onCommit={commit}/>:<div className="static-effect"><p>This effect is ready to add to the non-destructive stack.</p><Button onClick={()=>patch({effect:effect??null},true)}><Plus size={14}/>Add {tool.name}</Button></div>;return group(control);}
 if(tool.mode==="color") { const sliders:Array<[string,keyof Config,number,number,number,string]>=[["Brightness","brightness",-100,100,1,"%"],["Contrast","contrast",-100,100,1,"%"],["Saturation","saturation",-100,100,1,"%"],["Exposure","exposure",-2,2,.05,""],["Temperature","temperature",-100,100,1,""],["Hue","hue",-180,180,1,"°"],["Red","red",-100,100,1,"%"],["Green","green",-100,100,1,"%"],["Blue","blue",-100,100,1,"%"]];return group(<><div className="reset"><span>Adjustments</span><button onClick={()=>patch({brightness:0,contrast:0,saturation:0,exposure:0,temperature:0,hue:0,red:0,green:0,blue:0},true)}>Reset all</button></div>{sliders.map(([name,key,min,max,step,unit])=><Slider key={String(key)} label={name} value={Number(config[key])} min={min} max={max} step={step} unit={unit} defaultValue={0} onChange={(value)=>patch({[key]:value} as Partial<Config>)} onCommit={commit}/>)}</>); }
 if(tool.mode==="transparent"){if(tool.id==="transparent")return group(<><Color label="Key color" value={config.keyColor} onChange={(value)=>patch({keyColor:value},true)}/><Slider label="Tolerance" value={config.tolerance} min={0} max={180} onChange={(value)=>patch({tolerance:value})} onCommit={commit}/></>);if(tool.id==="remove-bg")return group(<><Slider label="Edge color tolerance" value={config.tolerance} min={4} max={180} onChange={(value)=>patch({tolerance:value})} onCommit={commit}/><p>Samples the edge color locally, best for clean single-color backgrounds.</p></>);if(tool.id==="background")return group(<><Color label="Background color" value={config.background} onChange={(value)=>patch({background:value},true)}/><Slider label="Alpha" value={config.alpha} min={0} max={100} unit="%" onChange={(value)=>patch({alpha:value})} onCommit={commit}/></>);return group(<p>Unused transparent margins are removed on export.</p>);}
 if(tool.mode==="privacy")return group(<><p>Draw directly on the canvas. Drag a selection to move it; use its lower-right handle to resize.</p>{tool.effect==="blur"&&<Slider label="Blur radius" value={config.blur} min={2} max={40} unit=" px" onChange={(value)=>patch({blur:value})} onCommit={commit}/>} {tool.effect==="pixelate"&&<Slider label="Pixel size" value={config.pixelSize} min={3} max={80} unit=" px" onChange={(value)=>patch({pixelSize:value})} onCommit={commit}/>} {tool.effect==="redact"&&<Color label="Redaction color" value={config.borderColor} onChange={(value)=>patch({borderColor:value},true)}/>}<div className="reset"><span>{config.masks.length} selections</span>{config.masks.length>0&&<button onClick={clearMasks}>Clear</button>}</div></>);
 if(tool.mode==="text")return group(<><label className="textarea"><b>Text</b><textarea value={config.text} maxLength={160} onChange={(event)=>patch({text:event.target.value})} onBlur={commit}/></label><Color label="Text color" value={config.textColor} onChange={(value)=>patch({textColor:value},true)}/><Slider label="Text size" value={config.textSize} min={12} max={180} unit=" px" onChange={(value)=>patch({textSize:value})} onCommit={commit}/><Slider label="Opacity" value={config.textOpacity} min={5} max={100} unit="%" onChange={(value)=>patch({textOpacity:value})} onCommit={commit}/></>);
 if(tool.mode==="shape"){if(tool.id==="corners")return group(<><Slider label="Corner radius" value={config.radius} min={0} max={180} unit=" px" onChange={(value)=>patch({radius:value})} onCommit={commit}/><p>PNG, WebP and ICO retain transparent corners.</p></>);if(tool.id==="border")return group(<><Slider label="Border width" value={config.borderWidth} min={1} max={80} unit=" px" onChange={(value)=>patch({borderWidth:value})} onCommit={commit}/><Color label="Border color" value={config.borderColor} onChange={(value)=>patch({borderColor:value},true)}/></>);return group(<><Slider label="Blur" value={config.shadowBlur} min={0} max={72} unit=" px" onChange={(value)=>patch({shadowBlur:value})} onCommit={commit}/><Slider label="Opacity" value={config.shadowOpacity} min={0} max={100} unit="%" onChange={(value)=>patch({shadowOpacity:value})} onCommit={commit}/></>);}
 if(tool.mode==="grid")return group(<><p>Uses selected images from the file queue and crops each tile locally.</p><Slider label="Columns" value={config.gridColumns} min={1} max={6} onChange={(value)=>patch({gridColumns:value})} onCommit={commit}/><Slider label="Gap" value={config.gridGap} min={0} max={64} unit=" px" onChange={(value)=>patch({gridGap:value})} onCommit={commit}/><Color label="Grid background" value={config.background} onChange={(value)=>patch({background:value},true)}/></>);
 if(tool.mode==="favicon")return group(<><label className="input-label">Format<ImageLabSelect label="Icon format" value={config.format} options={[{value:"ICO",label:"ICO"},{value:"PNG",label:"PNG"}]} onChange={(value)=>patch({format:value as Format},true)}/></label><Slider label="Icon size" value={config.iconSize} min={16} max={256} step={16} unit=" px" defaultValue={64} onChange={(value)=>patch({iconSize:value,width:value,height:value})} onCommit={commit}/></>);
 return group(<p>This tool works directly from your active local image.</p>); }

function AppliedEdits({operations,selectedId,onEdit,onToggle,onReset,onDuplicate,onRemove,onMove,onReorder,onResetImage,onMenu}:{operations:Operation[];selectedId:string|null;onEdit:(id:string)=>void;onToggle:(id:string)=>void;onReset:(id:string)=>void;onDuplicate:(id:string)=>void;onRemove:(id:string)=>void;onMove:(id:string,direction:number)=>void;onReorder:(id:string,targetId:string)=>void;onResetImage:()=>void;onMenu:(id:string,x:number,y:number)=>void}) {
  const dragging=useRef<string | null>(null);
  return <section className="applied-edits" aria-label="Applied edits"><header><div><small>Non-destructive stack</small><h3>Applied edits</h3></div>{operations.length>0&&<button className="quiet-stack-action" type="button" onClick={onResetImage}>Reset image</button>}</header>{operations.length===0?<p>Your compatible edits stay here. Select a tool, then make a change to add it.</p>:<div className="edit-stack">{operations.map((operation,index)=><article key={operation.instanceId} data-operation-id={operation.instanceId} draggable onDragStart={(event)=>{if(!(event.target as HTMLElement).closest(".edit-handle")){event.preventDefault();return;}dragging.current=operation.instanceId;event.dataTransfer.effectAllowed="move";}} onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="move";}} onDrop={(event)=>{event.preventDefault();if(dragging.current&&dragging.current!==operation.instanceId)onReorder(dragging.current,operation.instanceId);dragging.current=null;}} className={`${operation.instanceId===selectedId?"selected ":""}${operation.enabled?"":"disabled"}`}><button type="button" className="edit-handle" aria-label={`Reorder ${getTool(operation.toolId).name}`}><GripVertical size={14}/></button><button type="button" className="edit-main" onClick={()=>onEdit(operation.instanceId)}><b>{getTool(operation.toolId).name}</b><small>{operationSummary(operation)}</small></button><ImageLabTooltip label={operation.enabled?`Disable ${getTool(operation.toolId).name}`:`Enable ${getTool(operation.toolId).name}`}><button type="button" className="edit-enable" onClick={()=>onToggle(operation.instanceId)} aria-label={operation.enabled?`Disable ${getTool(operation.toolId).name}`:`Enable ${getTool(operation.toolId).name}`}>{operation.enabled?<Eye size={14}/>:<EyeOff size={14}/>}</button></ImageLabTooltip><button className="edit-more" type="button" aria-label={`More actions for ${getTool(operation.toolId).name}`} onClick={(event)=>onMenu(operation.instanceId,event.clientX,event.clientY)}><MoreHorizontal size={15}/></button><div className="edit-mobile-actions"><button disabled={index===0} onClick={()=>onMove(operation.instanceId,-1)} aria-label="Move edit up"><ArrowUp size={12}/></button><button disabled={index===operations.length-1} onClick={()=>onMove(operation.instanceId,1)} aria-label="Move edit down"><ArrowDown size={12}/></button><button onClick={()=>onReset(operation.instanceId)} aria-label={`Reset ${getTool(operation.toolId).name}`}><RotateCcw size={12}/></button><button onClick={()=>onDuplicate(operation.instanceId)} aria-label={`Duplicate ${getTool(operation.toolId).name}`}><CopyPlus size={12}/></button><button onClick={()=>onRemove(operation.instanceId)} aria-label={`Remove ${getTool(operation.toolId).name}`}><Trash2 size={12}/></button></div></article>)}</div>}</section>;
}

export function PalettePanel({state,values,count,setCount,copied,copy}:{state:string;values:Array<{hex:string;rgb:string;hsl:string}>;count:number;setCount:(value:number)=>void;copied:string;copy:(value:string)=>void}) { return <section className="panel"><h3>Color Palette</h3><div className="segmented">{[3,5,8,12].map((value)=><button className={value===count?"selected":""} key={value} onClick={()=>setCount(value)}>{value}</button>)}</div>{state==="working"?<div className="skeleton-list">{Array.from({length:count},(_,index)=><i key={index}/>)}</div>:values.length?<div className="palette-list">{values.map((value)=><button key={value.hex} onClick={()=>copy(value.hex)}><i style={{background:value.hex}}/><span><b>{value.hex}</b><small>{value.rgb}</small><small>{value.hsl}</small></span><em>{copied===value.hex?"Copied":"Copy"}</em></button>)}</div>:<p>{state==="error"?"Could not sample colors from this image.":"Pick a color count to extract a local palette."}</p>}</section> }
function MetadataPanel({file,data,state,copied,copy}:{file:Item|null;data:Record<string,unknown>|null;state:string;copied:string;copy:(value:string)=>void}) {if(!file)return null;const basic:Array<[string,string|undefined]>=[["Filename",file.name],["File size",formatBytes(file.size)],["Dimensions",displayDimensions(file.width,file.height)],["Aspect ratio",file.width&&file.height?`${(file.width/file.height).toFixed(3)}:1`:undefined],["Megapixels",file.width&&file.height?((file.width*file.height)/1000000).toFixed(2):undefined],["MIME type",file.type]],keys:Array<[string,string]>=[["Make","Make"],["Model","Model"],["Lens","LensModel"],["ISO","ISO"],["Aperture","FNumber"],["Exposure","ExposureTime"],["Focal length","FocalLength"],["Created","DateTimeOriginal"],["GPS latitude","latitude"],["GPS longitude","longitude"]];const row=([label,value]:[string,string])=><button className="metadata-row" key={label} onClick={()=>copy(value)}><span>{label}</span><b>{value}</b><em>{copied===value?"Copied":"Copy"}</em></button>;return <section className="panel"><h3>Image Inspector</h3><div className="metadata">{basic.filter((value):value is [string,string]=>Boolean(value[1])).map(row)}</div>{state==="working"?<div className="skeleton-list">{[1,2,3].map(value=><i key={value}/>)}</div>:data&&Object.keys(data).length>0&&<><hr/><h4>Embedded metadata</h4><div className="metadata">{keys.filter(([,key])=>data[key]!==undefined&&data[key]!==null).map(([label,key])=>row([label,String(data[key])]))}</div></>}{state==="error"&&<p>No readable embedded metadata was found.</p>}</section> }
function SettingsPanel({settings,setSettings,clear}:{settings:Settings;setSettings:(value:Settings)=>void;clear:()=>void}) {return <section className="settings"><small>ImageLab</small><h2>Settings</h2><section><h3>Appearance</h3><label>Theme<ImageLabSelect label="Theme" value={settings.theme} options={[{value:"light",label:"Light"},{value:"dark",label:"Dark"},{value:"system",label:"System"}]} onChange={(value)=>setSettings({...settings,theme:value as Theme})}/></label><label>Interface density<ImageLabSelect label="Interface density" value={settings.density} options={[{value:"comfortable",label:"Comfortable"},{value:"compact",label:"Compact"}]} onChange={(value)=>setSettings({...settings,density:value as Settings["density"]})}/></label></section><hr/><section><h3>Processing</h3><label>Preview quality<ImageLabSelect label="Preview quality" value={settings.preview} options={[{value:"fast",label:"Fast"},{value:"balanced",label:"Balanced"},{value:"high",label:"High"}]} onChange={(value)=>setSettings({...settings,preview:value as Settings["preview"]})}/></label><Toggle label="Memory-conscious mode" help="Uses smaller previews for large images." value={settings.memory} onChange={(value)=>setSettings({...settings,memory:value})}/></section><hr/><section><h3>Privacy & local data</h3><p>Images are processed locally in your browser and are not uploaded during normal editing operations.</p><Toggle label="Keep copies in Recent" help="Stores originals only on this device." value={settings.saveCopies} onChange={(value)=>setSettings({...settings,saveCopies:value})}/><button className="danger" onClick={clear}><Trash2 size={14}/>Clear recent sessions</button></section><hr/><section><h3>Downloads</h3><label>Default filename<ImageLabSelect label="Default filename" value={settings.naming} options={[{value:"imagelab",label:"Add “-imagelab”"},{value:"original",label:"Keep original name"}]} onChange={(value)=>setSettings({...settings,naming:value as Settings["naming"]})}/></label></section><hr/><section><h3>Accessibility</h3><Toggle label="Reduce motion" help="Minimizes nonessential movement and delayed previews." value={settings.motion} onChange={(value)=>setSettings({...settings,motion:value})}/><p className="shortcut"><Command size={14}/><span><kbd>⌘ / Ctrl K</kbd> commands · <kbd>⌘ / Ctrl Z</kbd> undo · <kbd>Space + drag</kbd> pan</span></p></section></section> }

function SettingBlock({ id, highlighted, children }: { id: string; highlighted: boolean; children: ReactNode }) {
  const blockRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!highlighted) return;
    const frame = window.requestAnimationFrame(() => {
      blockRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      blockRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlighted]);
  return <section ref={blockRef} className={`settings-setting ${highlighted ? "highlighted" : ""}`} data-setting-id={id} tabIndex={-1}>{children}</section>;
}

function SettingsExperience({ section, search, setSearch, focusId, clearFocus, settings, setSettings, clear, onSection, onBack, updateState, checkUpdates, applyUpdate, dismissUpdate }: { section: SettingsSection; search: string; setSearch: (value: string) => void; focusId: string | null; clearFocus: () => void; settings: Settings; setSettings: (value: Settings) => void; clear: () => void; onSection: (section: SettingsSection, focus?: string | null) => void; onBack: () => void; updateState: UpdateState; checkUpdates: () => Promise<void>; applyUpdate: () => Promise<void>; dismissUpdate: () => void }) {
  const [cleared, setCleared] = useState(false);
  const results = useMemo(() => searchSettings(search).slice(0, 8), [search]);
  useEffect(() => {
    if (!focusId) return;
    const timer = window.setTimeout(clearFocus, 1600);
    return () => window.clearTimeout(timer);
  }, [clearFocus, focusId]);
  const selectResult = (id: string, target: SettingsSection) => { setSearch(""); onSection(target, id); };
  const setting = (id: string) => focusId === id;
  const copy = (value: Settings) => setSettings(value);
  const clearRecents = () => { clear(); setCleared(true); window.setTimeout(() => setCleared(false), 1800); };
  const currentSection = getSettingsSection(section);
  return <main className="settings-page">
    <header className="settings-page-header"><button className="settings-back" type="button" onClick={onBack}><ArrowLeft size={15}/>Back to workspace</button><div><small>Settings</small><h1>{section === "overview" ? "Settings" : currentSection.title}</h1><p>{section === "overview" ? "Control how ImageLab looks, processes images, stores local data, and receives updates." : currentSection.description}</p></div></header>
    <label className="settings-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search settings" aria-label="Search settings"/><kbd>⌘ K</kbd></label>
    {search && <section className="settings-search-results" aria-label="Settings search results"><header><span>Results</span><button type="button" onClick={() => setSearch("")}>Clear</button></header>{results.length ? results.map((result) => <button type="button" key={result.id} onClick={() => selectResult(result.id, result.section)}><span><b>{result.title}</b><small>{getSettingsSection(result.section).title} · {result.description}</small></span><ChevronRight size={15}/></button>) : <p>No settings match “{search}”.</p>}</section>}
    <div className={`settings-layout section-${section}`}>
      <nav className="settings-nav" aria-label="Settings categories">{settingsSections.slice(1).map((item) => <button type="button" key={item.id} className={section === item.id ? "selected" : ""} onClick={() => onSection(item.id)}><span><b>{item.title}</b><small>{item.description}</small></span><ChevronRight size={15}/></button>)}</nav>
      <section className="settings-content">
        {section !== "overview" && <button type="button" className="settings-mobile-back" onClick={() => onSection("overview")}><ArrowLeft size={14}/>All settings</button>}
        {section === "overview" && <section className="settings-overview"><h2>Choose a category</h2><p>Settings stay on this device and do not change your image processing workflow.</p><div>{settingsSections.slice(1).map((item) => <button type="button" key={item.id} onClick={() => onSection(item.id)}><span><b>{item.title}</b><small>{item.description}</small></span><ChevronRight size={15}/></button>)}</div></section>}
        {section === "appearance" && <section className="settings-section"><h2>Appearance</h2><SettingBlock id="appearance.theme" highlighted={setting("appearance.theme")}><label>Theme<ImageLabSelect label="Theme" value={settings.theme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} onChange={(value) => copy({ ...settings, theme: value as Theme })}/></label><p>Choose how ImageLab appears across your device.</p></SettingBlock><SettingBlock id="appearance.density" highlighted={setting("appearance.density")}><label>Interface density<ImageLabSelect label="Interface density" value={settings.density} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} onChange={(value) => copy({ ...settings, density: value as Settings["density"] })}/></label><p>Compact keeps more controls visible in the workspace.</p></SettingBlock></section>}
        {section === "processing" && <section className="settings-section"><h2>Processing</h2><SettingBlock id="processing.preview" highlighted={setting("processing.preview")}><label>Preview quality<ImageLabSelect label="Preview quality" value={settings.preview} options={[{ value: "fast", label: "Fast" }, { value: "balanced", label: "Balanced" }, { value: "high", label: "High" }]} onChange={(value) => copy({ ...settings, preview: value as Settings["preview"] })}/></label><p>Interactive previews use this preference before ImageLab renders a high-quality result.</p></SettingBlock><SettingBlock id="processing.memory" highlighted={setting("processing.memory")}><Toggle label="Memory-conscious mode" help="Uses smaller previews for large images." value={settings.memory} onChange={(value) => copy({ ...settings, memory: value })}/></SettingBlock><section className="settings-setting"><h3>Accessibility</h3><Toggle label="Reduce motion" help="Minimizes nonessential movement and delayed previews." value={settings.motion} onChange={(value) => copy({ ...settings, motion: value })}/></section></section>}
        {section === "privacy" && <section className="settings-section"><h2>Privacy & local data</h2><SettingBlock id="privacy.local" highlighted={setting("privacy.local")}><h3>Local processing</h3><p>Images are processed locally in your browser and are not uploaded during normal editing operations.</p></SettingBlock><SettingBlock id="privacy.recents" highlighted={setting("privacy.recents")}><Toggle label="Keep copies in Recent" help="Stores local session metadata on this device." value={settings.saveCopies} onChange={(value) => copy({ ...settings, saveCopies: value })}/></SettingBlock><SettingBlock id="privacy.clear" highlighted={setting("privacy.clear")}><h3>Recent sessions</h3><p>Remove the local metadata used for the Recent list. Imported images are not sent anywhere.</p><Button className="danger" onClick={clearRecents}><Trash2 size={14}/>{cleared ? "Cleared" : "Clear recent sessions"}</Button></SettingBlock><section className="settings-setting"><h3>Downloads</h3><label>Default filename<ImageLabSelect label="Default filename" value={settings.naming} options={[{ value: "imagelab", label: "Add “-imagelab”" }, { value: "original", label: "Keep original name" }]} onChange={(value) => copy({ ...settings, naming: value as Settings["naming"] })}/></label></section></section>}
        {section === "updates" && <UpdatesPanel focusId={focusId} settings={settings} setSettings={copy} state={updateState} onCheck={checkUpdates} onApply={applyUpdate} onLater={dismissUpdate}/>}
        {section === "about" && <section className="settings-section about-section"><h2>ImageLab</h2><p>Local-first image editing toolkit for the browser.</p><SettingBlock id="about.version" highlighted={setting("about.version")}><dl className="about-version"><div><dt>Version</dt><dd>{APP_VERSION}</dd></div><div><dt>License</dt><dd>MIT</dd></div></dl><ImageLabDisclosure label="Build information"><dl className="build-info"><div><dt>Version</dt><dd>{APP_BUILD.version}</dd></div><div><dt>Commit</dt><dd>{APP_BUILD.commit}</dd></div><div><dt>Build</dt><dd>{new Date(APP_BUILD.builtAt).toLocaleString()}</dd></div></dl></ImageLabDisclosure></SettingBlock><SettingBlock id="about.source" highlighted={setting("about.source")}><div className="about-actions"><a className="button" href={APP_REPOSITORY_URL} target="_blank" rel="noreferrer"><Github size={15}/>View source<ExternalLink size={13}/></a><Button onClick={() => onSection("updates", "updates.check")}><RefreshCw size={14}/>Check for updates</Button></div></SettingBlock></section>}
      </section>
    </div>
  </main>;
}

function UpdatesPanel({ focusId, settings, setSettings, state, onCheck, onApply, onLater }: { focusId: string | null; settings: Settings; setSettings: (next: Settings) => void; state: UpdateState; onCheck: () => Promise<void>; onApply: () => Promise<void>; onLater: () => void }) {
  const checking = state.status === "checking";
  const applying = state.status === "applying";
  const showPrepared = state.workerReady;
  const release = state.latest;
  return <section className="settings-section updates-section"><h2>Updates</h2><SettingBlock id="updates.auto-check" highlighted={focusId === "updates.auto-check"}><Toggle label="Automatically check for updates" help="Checks occasionally on launch; no image or workspace data is included." value={settings.autoUpdateChecks} onChange={(value) => setSettings({ ...settings, autoUpdateChecks: value })}/></SettingBlock><SettingBlock id="updates.check" highlighted={focusId === "updates.check"}><dl className="update-versions"><div><dt>Current version</dt><dd>{APP_VERSION}</dd></div><div><dt>Latest version</dt><dd>{release?.version ?? (checking ? "Checking…" : "Not checked")}</dd></div></dl><div className="update-actions"><Button onClick={() => void onCheck()} disabled={checking || applying}><RefreshCw size={14} className={checking ? "spin" : ""}/>{checking ? "Checking…" : "Check for updates"}</Button>{showPrepared && <Button className="primary" onClick={() => void onApply()} disabled={applying}><Download size={14}/>{applying ? "Preparing…" : "Update now"}</Button>}{release?.url && (state.status === "available" || state.status === "current") && <a className="button" href={release.url} target="_blank" rel="noreferrer">View changes<ExternalLink size={13}/></a>}</div>{state.status === "current" && !showPrepared && <p className="update-message">You’re up to date. ImageLab {APP_VERSION} is the latest stable release.</p>}{state.status === "available" && <div className="update-message available"><b>{showPrepared ? (release ? `ImageLab ${release.version} is ready.` : "A refreshed ImageLab build is ready.") : `ImageLab ${release?.version ?? "update"} is available.`}</b>{release?.notes && <span>{releaseSummary(release.notes)}</span>}{showPrepared ? <small>The updated assets are cached locally. Updating will preserve the current workspace where the browser can restore it.</small> : <small>This stable release is published, but this deployed copy has not cached its newer assets yet. Check again after new assets reach this app.</small>}{showPrepared && <button type="button" onClick={onLater}>Later</button>}</div>}{state.status === "offline" && <p className="update-message">Couldn’t check for updates while offline. <button type="button" onClick={() => void onCheck()}>Try again</button></p>}{state.status === "error" && <p className="update-message">Couldn’t check for updates. <button type="button" onClick={() => void onCheck()}>Retry</button>{state.message && <small>{state.message}</small>}</p>}</SettingBlock><p className="update-footnote">Stable channel · Update checks only request public release metadata. Images, filenames, edits, and workspace contents are never sent.</p></section>;
}
function Export({current,config,preview,job,selected,processing,exportCurrent,exportAll,zip,cancel,copy,copied}:{current:Item;config:Config;preview:{width:number;height:number;bytes?:number}|null;job:Job;selected:number;processing:boolean;exportCurrent:()=>void;exportAll:()=>void;zip:()=>void;cancel:()=>void;copy:()=>void;copied:boolean}){return <section className="export"><hr/><header><h3>Export</h3>{preview?.bytes&&<span>{formatBytes(preview.bytes)} estimated</span>}</header><p>{preview?displayDimensions(preview.width,preview.height):displayDimensions(current.width,current.height)} · {config.format} · {config.quality}%</p>{processing&&<div className="export-progress"><span><b>{job.text}</b><em>{job.phase==="zipping"?`${job.progress}%`:`${job.current} / ${job.total}`}</em></span><i><b style={{width:`${job.progress}%`}}/></i><button onClick={cancel}>Cancel</button></div>}{job.phase==="failed"&&<p className="error">{job.text} <button onClick={exportCurrent}>Retry</button></p>}{job.phase==="cancelled"&&<p className="muted">Export cancelled. <button onClick={exportCurrent}>Restart</button></p>}<Button className="primary export-main" disabled={processing} onClick={exportCurrent}><ArrowDownToLine size={16}/>{processing ? "Working…" : selected > 1 ? `Export selected (${selected})` : "Export image"}</Button><div className="export-actions"><button onClick={copy} disabled={processing}><Copy size={13}/>{copied?"Copied":"Copy image"}</button>{selected>1&&<button onClick={zip} disabled={processing}><Download size={13}/>Download ZIP</button>}<button onClick={exportAll} disabled={processing}><Download size={13}/>Export all</button></div></section>}
function Commands({query,setQuery,entries,close}:{query:string;setQuery:(value:string)=>void;entries:Array<{id:string;name:string;description:string;icon:string;run:()=>void}>;close:()=>void}){return <div className="commands-backdrop" onMouseDown={close}><section className="commands" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event)=>event.stopPropagation()} onKeyDown={(event)=>{if(event.key==="Escape"){event.preventDefault();close()}}}><div><Search size={17}/><input autoFocus value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search tools, actions, and settings…"/><kbd>Esc</kbd></div><main>{entries.slice(0,12).map((entry)=><button key={entry.id} onClick={()=>{entry.run();close();}}><i><Icon name={entry.icon}/></i><span><b>{entry.name}</b><small>{entry.description}</small></span><ChevronRight size={15}/></button>)||<p>No results.</p>}</main><footer><span><Command size={13}/>Enter to run</span><span>Fuzzy search enabled</span></footer></section></div>}
