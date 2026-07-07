# Reader Page Fit Options — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Replace the boolean `limitPageHeight` toggle in the manga reader with a 4-mode fit selector plus an enhanced page-gap control available in all read modes.

**Architecture:** Pure frontend change. Settings stored in localStorage. `fitMode` replaces `limitPageHeight`; a new `pageFitLimitPx` key stores the custom pixel value. Migration: if `fitMode` key absent but `limitPageHeight === 'true'`, default to `'height'`.

**Tech Stack:** React 18, Tailwind CSS, localStorage  
**File:** `lectormoe-frontend/src/components/Reader.jsx` (1357 lines) — only this file changes.

---

### Task 1: Extend settings state and callbacks

**Files:**
- Modify: `lectormoe-frontend/src/components/Reader.jsx:156-288`

- [ ] **Step 1: Replace `limitPageHeight` with `fitMode` + `pageFitLimitPx` in initial state**

Find the `useState` for `settings` (~line 156) and replace:
```js
// BEFORE
limitPageHeight: localStorage.getItem("limitPageHeight") === "true",

// AFTER — add these two lines, remove limitPageHeight
fitMode: (() => {
  const saved = localStorage.getItem('fitMode');
  if (saved) return saved;
  return localStorage.getItem('limitPageHeight') === 'true' ? 'height' : 'none';
})(),
pageFitLimitPx: parseInt(localStorage.getItem('pageFitLimitPx') || '900', 10),
```

- [ ] **Step 2: Replace `handleLimitPageHeight` with two new handlers**

Remove `handleLimitPageHeight` (~line 274). Add:
```js
const handleFitMode = useCallback((mode) => {
  localStorage.setItem('fitMode', mode);
  setSettings((prev) => ({ ...prev, fitMode: mode }));
}, []);

const handlePageFitLimitPx = useCallback((value) => {
  const px = Math.max(100, Math.min(3000, parseInt(value, 10) || 900));
  localStorage.setItem('pageFitLimitPx', String(px));
  setSettings((prev) => ({ ...prev, pageFitLimitPx: px }));
}, []);
```

- [ ] **Step 3: Make `pageGap` work in both cascade AND paginated modes**

Currently `pageGap` is only rendered in cascade mode (line 991 wraps it in `settings.readType === readTypes.CASCADE`). Remove that outer condition — gap applies to both. The `getPageContainerStyle` already applies the gap unconditionally based on `isCascade`, so update it to always apply gap:
```js
// BEFORE
const getPageContainerStyle = useCallback(
  (isCascade) => ({
    marginBottom: isCascade ? `${getGapValue(settings.pageGap)}px` : "0",
  }),
  [settings.pageGap, getGapValue]
);

// AFTER
const getPageContainerStyle = useCallback(
  (_isCascade) => ({
    marginBottom: `${getGapValue(settings.pageGap)}px`,
  }),
  [settings.pageGap, getGapValue]
);
```

- [ ] **Step 4: Commit**
```bash
git add lectormoe-frontend/src/components/Reader.jsx
git commit -m "feat(reader): add fitMode state and pageFitLimitPx, migrate from limitPageHeight"
```

---

### Task 2: Update `getImageClassName` and add `getImageStyle`

**Files:**
- Modify: `lectormoe-frontend/src/components/Reader.jsx:395-420`

- [ ] **Step 1: Replace the `getImageClassName` callback**

Find `getImageClassName` (~line 395). Replace the `limitPageHeight` logic:
```js
const getImageClassName = useCallback(
  (isSideBySide) => {
    let className = 'pointer-events-none object-contain';
    if (isSideBySide) {
      className += ' w-1/2';
    } else {
      className += ' w-auto max-w-full';
    }
    switch (settings.fitMode) {
      case 'height':
        className += ' max-h-[100vh] h-auto';
        break;
      case 'width':
        className += ' w-full h-auto max-w-full';
        break;
      case 'limitH':
      case 'limitW':
        className += ' h-auto';
        break;
      default:
        className += ' h-auto';
    }
    return className;
  },
  [settings.fitMode, settings.readType, readTypes.PAGINATED, readTypes.CASCADE]
);
```

- [ ] **Step 2: Add `getImageStyle` callback (for pixel-limit modes)**

Add after `getImageClassName`:
```js
const getImageStyle = useCallback(
  () => {
    if (settings.fitMode === 'limitH') return { maxHeight: `${settings.pageFitLimitPx}px` };
    if (settings.fitMode === 'limitW') return { maxWidth: `${settings.pageFitLimitPx}px` };
    return {};
  },
  [settings.fitMode, settings.pageFitLimitPx]
);
```

- [ ] **Step 3: Pass `style` through PageImage → LazyImage**

Update `PageImage` component (~line 26) to accept and pass `imgStyle`:
```js
const PageImage = memo((props) => {
  const { page, isSideBySide, isLeft, getImageClassName, getImageStyle, _ } = props;
  return (
    <LazyImage
      id={`page-${page.number}-img`}
      src={page.imageUrl}
      className={`${getImageClassName(isSideBySide)} ${
        isSideBySide && (isLeft ? 'object-left' : 'object-right')
      }`}
      style={getImageStyle()}
      alt={`${_('page')} ${page.number}`}
      loading="lazy"
      decoding="async"
    />
  );
});
```

Update all `<PageImage ... />` usages (~lines 771, 814, 824, 853) to pass `getImageStyle={getImageStyle}`.

- [ ] **Step 4: Check if `LazyImage` accepts `style` prop**

Read `lectormoe-frontend/src/components/LazyImage.jsx` (or `.tsx`). If it doesn't forward `style` to the `<img>`, add it:
```jsx
// Wherever LazyImage renders the <img>, ensure style is spread:
<img {...rest} style={style} className={className} ... />
```

- [ ] **Step 5: Commit**
```bash
git add lectormoe-frontend/src/components/Reader.jsx
git commit -m "feat(reader): apply fitMode CSS to images, support limitH/limitW with inline style"
```

---

### Task 3: Replace settings UI panel

**Files:**
- Modify: `lectormoe-frontend/src/components/Reader.jsx:954-1015`

- [ ] **Step 1: Replace the `limitPageHeight` toggle with the fit-mode selector**

Find the settings panel block starting at ~line 954. Replace the "Limitar altura de página" checkbox and the entire left column (`<div className="space-y-4">`) with:

```jsx
<div className="space-y-4">
  {/* Ajuste de página */}
  <div className="mx-4">
    <label className="block text-sm font-medium text-gray-100 mb-2">Ajuste de imagen</label>
    <div className="flex flex-wrap gap-2">
      {[
        { value: 'none', label: 'Sin límite' },
        { value: 'height', label: 'Alto ventana' },
        { value: 'width', label: 'Ancho ventana' },
        { value: 'limitH', label: 'Límite alto' },
        { value: 'limitW', label: 'Límite ancho' },
      ].map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleFitMode(value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            settings.fitMode === value
              ? 'bg-red-500 text-white shadow'
              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 border border-zinc-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
    {(settings.fitMode === 'limitH' || settings.fitMode === 'limitW') && (
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={100}
          max={3000}
          step={50}
          value={settings.pageFitLimitPx}
          onChange={(e) => handlePageFitLimitPx(e.target.value)}
          className="w-24 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        <span className="text-xs text-gray-400">px</span>
      </div>
    )}
  </div>

  {/* Usar páginas dobles */}
  <div className="flex items-center gap-3 mx-4">
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={settings.useDoublePages}
        onChange={handleToggleUseDoublePages}
      />
      <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
      <span className="ms-3 text-sm font-medium text-gray-100">{_('use_double_pages')}</span>
    </label>
  </div>

  {/* Espacio entre páginas */}
  <div className="mx-4">
    <label className="block text-sm font-medium text-gray-100 mb-2">Espacio entre páginas</label>
    <select
      value={settings.pageGap}
      onChange={(e) => handlePageGap(e.target.value)}
      className="w-full sm:w-72 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all cursor-pointer hover:bg-zinc-700"
    >
      <option value="ninguno" className="bg-zinc-800">Ninguno (0px)</option>
      <option value="minimo" className="bg-zinc-800">Mínimo (2px)</option>
      <option value="medio" className="bg-zinc-800">Medio (5px)</option>
      <option value="grande" className="bg-zinc-800">Grande (10px)</option>
    </select>
  </div>
</div>
```

Note: the gap selector is no longer wrapped in `settings.readType === readTypes.CASCADE`.

- [ ] **Step 2: Remove any remaining references to `handleLimitPageHeight` and `limitPageHeight`**

Search the file for `limitPageHeight` and remove/replace any remaining occurrences.

- [ ] **Step 3: Commit**
```bash
git add lectormoe-frontend/src/components/Reader.jsx
git commit -m "feat(reader): replace limitPageHeight toggle with 5-mode fit selector + always-on gap"
```
