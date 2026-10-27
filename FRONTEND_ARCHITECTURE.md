# Anima Tools Frontend Architecture

## Selector popups

The artist, character, clothing, background, and pose selectors share one popup implemented in `js/anima_gallery_selector.js`. The Anima Prompt nodes open it from a single button; it reopens on the last used selector, keeps selections while switching selectors, and on apply writes every selector whose selection changed to its own tag widget. Its layout and interaction model follow the CivitaiManager selector:

- top bar with selector tabs (with selected counts), filter-panel toggle, and close button
- left icon rail: All / Favorites / Selected
- collapsible filter panel: favorite groups (Favorites tab) and attribute filters as searchable combos
- toolbar with page title, sort and display-language menus, a More menu (copy / clear selected), search, and active-filter chips
- card grid with paging; clicking a card toggles selection, the info button opens the detail panel without selecting
- detail panel with preview, select, favorite and group management, prompt tags (click to copy), facts, and note
- footer with selection status, links, and apply buttons

Colors follow the ComfyUI theme (`--comfy-menu-bg`, `--fg-color`, `--primary-background`), so light and dark themes both work. All styles live in `js/anima_selector_ui.js` under the `anima-sel-` prefix and are injected once.

## Selector adapters

Each adapter exports a selector descriptor (kind, label, icon, tag widget name, data readiness, and `createConfig(widget)`). `js/anima_prompt_plus.js` passes them to `openPromptSelector` in widget order and adds the node widget from `js/anima_selector_random.js`: one button plus a row of per-section random toggles. Tag widgets are hidden (`widget.hidden`) while empty, unless their section is randomized or linked; visibility is refreshed on apply, execution sync, configure, and toggle changes.

| File | Selectors |
| --- | --- |
| `anima_artist_selector.js` | Artist |
| `anima_character_selector.js` | Character |
| `anima_tag_selectors.js` | Clothing, Background, Pose |

An adapter owns its data, image URLs, sort orders, filters, saved-filter format, card and detail metadata, and prompt output. The shared popup owns layout, selection, paging, favorites persistence, and widget write-back.

## LoRA manager

The Anima Multi LoRA Loader node and its "LoRA Manager" popup are copied from CivitaiManager (commit `e56604d`): `js/anima_lora_node.js` plus the modules in `js/lora_manager/`, backed by the Python package `lora_manager/`. The copy is isolated from an installed CivitaiManager:

- API under `/anima-tools/lora-manager/api`, data in `user/anima_tools_lora_manager/`
- CSS classes, CSS variables, node properties, and local storage keys use the `alm` prefix
- theme colors are sampled from the ComfyUI menu by `js/lora_manager/theme.js`

Differences from CivitaiManager: Discover always searches Anima LoRAs (the base model filter only applies to Local LoRAs), the library only scans `loras` roots, and node entries without a storage root (older Anima workflows) match a LoRA in any root. On first start the backend imports the Civitai API key from `user/anima_lora_config.json` and the LoRA favorites from `user/anima_tools_favorites.json`.

## Compatibility contract

- Python node class names, widget names, inputs, outputs, and prompt formatting (the single-category `Anima*TagSelector` / `Anima*TagSelectorPlus` nodes were removed in favor of Anima Prompt / Anima Prompt Plus)
- `/anima-tools/*` API paths and payload formats; favorites are saved per section
- Favorite groups, custom items, notes, and their stored shapes
- Local storage keys for sort, page, scroll, filters, and display language

Clicking outside the popup closes it without applying, the same as Esc and Cancel.
