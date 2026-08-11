"use client";

import { Copy, Download, MoreHorizontal, RefreshCw, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Button,
  EditorEmpty,
  IconButton,
  ImageLabCheckbox,
  ImageLabColorField,
  ImageLabContextMenu,
  ImageLabDialog,
  ImageLabDisclosure,
  ImageLabNumberInput,
  ImageLabProgress,
  ImageLabSelect,
  ImageLabSlider,
  ImageLabSwitch,
  ImageLabTooltip,
  List,
  PalettePanel,
  Queue,
  type ContextState,
  type Item,
  type MenuAction,
} from "../../components/image-lab";
import { getTool, tools } from "../../lib/tools";

const noop = () => {};
const subscribeHydration = () => () => {};

export default function DesignSystemShowcase() {
  const [format, setFormat] = useState("WebP");
  const [quality, setQuality] = useState(82);
  const [width, setWidth] = useState<number | null>(1280);
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(true);
  const [color, setColor] = useState("#276A5C");
  const [dialog, setDialog] = useState(false);
  const [menu, setMenu] = useState<ContextState>(null);
  const [selected, setSelected] = useState(["ready", "complete"]);
  const [active, setActive] = useState("ready");
  const mounted = useSyncExternalStore(subscribeHydration, () => true, () => false);

  const files = useMemo<Item[]>(() => [
    { id: "ready", file: {} as File, url: "/favicon.svg", name: "portrait.webp", size: 1_240_000, type: "image/webp", width: 1600, height: 1200, status: "ready" },
    { id: "processing", file: {} as File, url: "/favicon.svg", name: "banner.png", size: 3_820_000, type: "image/png", width: 2560, height: 1440, status: "processing", progress: 64 },
    { id: "failed", file: {} as File, url: "/favicon.svg", name: "broken.avif", size: 824_000, type: "image/avif", status: "failed", error: "Could not decode image." },
    { id: "complete", file: {} as File, url: "/favicon.svg", name: "export.jpg", size: 2_100_000, type: "image/jpeg", width: 1920, height: 1080, status: "ready", outputSize: 486_000, outputFormat: "WebP" },
  ], []);

  const menuItems: MenuAction[] = [
    { id: "copy", label: "Copy image", icon: Copy, run: noop },
    { id: "download", label: "Download", icon: Download, run: noop },
    { id: "separator", separator: true },
    { id: "remove", label: "Remove", icon: Trash2, tone: "danger", run: noop },
  ];

  return <main className="design-system-page">
    <header className="design-system-hero">
      <div>
        <small>Development only</small>
        <h1>ImageLab component reference</h1>
        <p>Live instances of the same components used by the editor. Resize the viewport and switch the app theme while reviewing changes.</p>
      </div>
      <Link href="/">Open ImageLab</Link>
    </header>

    <nav className="design-system-index" aria-label="Showcase sections">
      <a href="#actions">Actions</a><a href="#inputs">Inputs</a><a href="#feedback">Feedback</a><a href="#rows">Rows</a><a href="#overlays">Overlays</a>
    </nav>

    <section id="actions" className="design-system-section">
      <header><small>01</small><h2>Actions</h2><p>Default, primary, loading, disabled, icon-only, and tooltip states.</p></header>
      <div className="design-system-grid">
        <article className="design-system-card"><h3>Buttons</h3><div className="design-system-row"><Button>Default</Button><Button className="primary"><Download size={14}/>Export</Button><Button disabled>Disabled</Button><Button disabled><RefreshCw className="spin" size={14}/>Processing</Button></div></article>
        <article className="design-system-card"><h3>Icon actions</h3><div className="design-system-row"><IconButton label="Settings"><Settings size={15}/></IconButton><ImageLabTooltip label="More actions"><IconButton label="More actions"><MoreHorizontal size={15}/></IconButton></ImageLabTooltip></div></article>
      </div>
    </section>

    <section id="inputs" className="design-system-section">
      <header><small>02</small><h2>Inputs</h2><p>Custom controls retain native semantics while using ImageLab presentation.</p></header>
      <div className="design-system-grid">
        <article className="design-system-card"><h3>Select and number</h3><div className="design-system-form"><label>Format<ImageLabSelect label="Format" value={format} options={["PNG", "JPEG", "WebP", "AVIF"].map((value) => ({ value, label: value }))} onChange={setFormat}/></label><label>Width<ImageLabNumberInput label="Width" value={width} min={1} unit="px" defaultValue={1280} onChange={setWidth} onCommit={noop}/></label></div></article>
        <article className="design-system-card"><h3>Continuous controls</h3><div className="design-system-form"><ImageLabSlider label="Quality" value={quality} min={1} max={100} unit="%" defaultValue={82} onChange={setQuality} onCommit={noop}/><ImageLabColorField label="Accent" value={color} onChange={setColor}/></div></article>
        <article className="design-system-card"><h3>Boolean controls</h3><div className="design-system-form"><ImageLabSwitch label="Live preview" help="Update the persistent preview while editing." value={enabled} onChange={setEnabled}/><div className="design-system-check"><ImageLabCheckbox label="Select sample file" checked={checked} onChange={() => setChecked((value) => !value)}/><span>Select sample file</span></div></div></article>
        <article className="design-system-card"><h3>Disclosure</h3><ImageLabDisclosure label="Advanced"><p>Place uncommon options here without hiding required settings.</p></ImageLabDisclosure></article>
      </div>
    </section>

    <section id="feedback" className="design-system-section">
      <header><small>03</small><h2>Feedback</h2><p>Measured work, indeterminate content loading, and an empty editor state.</p></header>
      <div className="design-system-grid">
        <article className="design-system-card"><h3>Determinate progress</h3><div className="design-system-progress"><span><b>Encoding WebP</b><em>64%</em></span><ImageLabProgress value={64} label="Encoding WebP"/></div></article>
        <article className="design-system-card"><h3>Layout skeleton</h3><PalettePanel state="working" values={[]} count={5} setCount={noop} copied="" copy={noop}/></article>
        <article className="design-system-card design-system-empty"><h3>Empty workspace</h3><EditorEmpty tool={getTool("pixelate")} browse={noop} paste={noop}/></article>
      </div>
    </section>

    <section id="rows" className="design-system-section">
      <header><small>04</small><h2>Rows and collections</h2><p>Real file-queue and tool-list components, including selected, processing, failed, and completed file states.</p></header>
      <article className="design-system-card design-system-wide"><h3>File rows</h3>{mounted ? <Queue files={files} active={active} selected={selected} onActive={setActive} onToggle={(id) => setSelected((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id])} retry={noop} browse={noop} onMenu={(_, x, y) => setMenu({ target: { kind: "file", id: "ready" }, x, y })}/> : <p className="design-system-mounting">Loading live file rows…</p>}</article>
      <article className="design-system-card design-system-wide"><h3>Tool rows</h3><List title="Frequently used" hint="Registry-backed" values={tools.slice(0, 3)} choose={noop}/></article>
    </section>

    <section id="overlays" className="design-system-section">
      <header><small>05</small><h2>Overlays</h2><p>Keyboard-aware menu and focus-trapped dialog implementations.</p></header>
      <div className="design-system-row"><Button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ target: { kind: "canvas" }, x: rect.left, y: rect.bottom + 6 }); }}>Open context menu</Button><Button onClick={() => setDialog(true)}>Open dialog</Button></div>
    </section>

    {menu && <ImageLabContextMenu menu={menu} items={menuItems} close={() => setMenu(null)}/>} 
    {dialog && <ImageLabDialog title="Rename image" description="Use a clear local filename. The extension is added during export." onClose={() => setDialog(false)}><label className="dialog-field">Filename<input defaultValue="portrait-imagelab"/></label><div className="dialog-actions"><Button onClick={() => setDialog(false)}>Cancel</Button><Button className="primary" onClick={() => setDialog(false)}>Rename</Button></div></ImageLabDialog>}
  </main>;
}
