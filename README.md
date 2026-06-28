# Anima-Tools: ComfyUI Premium Artist, Character, Clothing & LoRA Visual Selector 🎨

<p align="center">
  <img src="https://img.shields.io/github/v/release/nregret/Comfyui-Anima-Tools?color=ff69b4&style=flat-square" alt="Release">
  <img src="https://img.shields.io/badge/ComfyUI-Custom__Nodes-blueviolet?style=flat-square" alt="ComfyUI Custom Nodes">
  <img src="https://img.shields.io/badge/Database-40K+_Artists-orange?style=flat-square" alt="Artist Database">
  <img src="https://img.shields.io/badge/i18n-ZH__CN%20%7C%20EN-green?style=flat-square" alt="i18n Supported">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License">
</p>

<p align="center">
  <strong>A high-performance, multi-dimensional visual prompt & Anima LoRA selection suite for ComfyUI, purpose-built for anime AI art creation.</strong>
</p>

<p align="center">
  Anima-Tools is a ComfyUI visual prompt and Anima LoRA assistant suite tailored specifically for anime AI art. It deeply integrates a massive artist style library, a detailed anime character encyclopedia, a clothing prompt gallery, a random prompt composer node, and a Civitai LoRA search & download panel — empowering creators to build their ideal anime scenes with maximum freedom and precision.
</p>

<p align="center">
  <a href="./README_ZH.md">中文文档</a>
</p>

---

## 🖼️ Visual Preview

> [!NOTE]
> The screenshots below show the actual interactive UI of the suite at runtime. After installation, you will get the exact same visual experience inside ComfyUI.

<table>
  <tr>
    <td align="center" width="50%">
      <strong>🎨 Artist Style Selector Panel</strong><br>
      <img src="./img/artist.jpeg" alt="Anima Artist Style Selector UI Preview"><br>
      <em>Fig 1. 40,000+ artist style library preview with uniqueness score & work count sorting</em>
    </td>
    <td align="center" width="50%">
      <strong>🎭 Character Tag Selector Panel</strong><br>
      <img src="./img/character.jpeg" alt="Anima Character Selector UI Preview"><br>
      <em>Fig 2. Multi-attribute anime character encyclopedia with cross-filtering by hair color, eye color, and fan-art popularity</em>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>🧩 Anima LoRA Loader Panel</strong><br>
      <img src="./img/lora.jpeg" alt="Anima LoRA Loader UI Preview"><br>
      <em>Fig 3. Anima LoRA search, preview, download, favorites, loaded LoRA management, and persistent thumbnail cache panel</em>
    </td>
    <td align="center" width="50%">
      <strong>⚙️ ComfyUI Node Layout (Workflow Preview)</strong><br>
      <img src="./img/nodes.jpeg" alt="ComfyUI Node Layout Preview"><br>
      <em>Fig 4. Workflow diagram showing the Standard, Plus, and Anima Multi LoRA Loader node assembly</em>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>👗 Clothing Tag Selector Panel</strong><br>
      <img src="./img/clothing.jpeg" alt="Anima Clothing Selector UI Preview"><br>
      <em>Fig 5. Clothing prompt gallery preview with category, feature, favorites, and custom item management</em>
    </td>
    <td align="center" width="50%">
      <strong>🎲 Prompt Composer Node Preview</strong><br>
      <img src="./img/prompt_composer.jpeg" alt="Anima Prompt Composer Node Preview"><br>
      <em>Fig 6. Randomly combines artist, character, and clothing at workflow runtime, displaying a result preview directly on the node</em>
    </td>
  </tr>
</table>

---

## 🗺️ Table of Contents
- [✨ Core Features](#-core-features)
- [⚙️ Installation](#-installation)
- [📖 Nodes Reference](#-nodes-reference)
- [📦 Project Structure](#-project-structure)
- [🤝 Credits & Acknowledgement](#-credits--acknowledgement)
- [📄 License](#-license)

---

## ✨ Core Features

### 🎨 1. Anima Artist Style Selector
*   **Artist Database:** Fully covers **40,000+** curated Danbooru artist styles (data based on [Anima-Style-Explorer](#-credits--acknowledgement)), with efficient front-end search support.
*   **Multi-Dimensional Search & Sorting:** Supports fuzzy search by artist name, and fast sorting by **Works Count**, **Uniqueness Score**, and **Alphabetical Order (A-Z / Z-A)** to help you precisely locate niche or popular styles.
*   **Smart `@` Formatting:** Both the front-end and the back-end Python node automatically format selected artists with the `@` prefix (e.g., selecting `dairi` outputs `@dairi`), and automatically strips redundant `by ` prefixes or duplicate symbols.

### 🎭 2. Anima Character Tag Selector
*   **Multi-Attribute Character Encyclopedia:** Deeply integrates an anime character wiki (data based on [AnimaDex](#-credits--acknowledgement)) with a large collection of classic and popular anime characters.
*   **Multi-Dimensional Cross-Filtering:** Provides a categorized browsing panel with cross-filtering by **character gender**, **hair color**, **eye color**, **fan-art popularity (total illustrations)**, and **anime series (Hot Series)**.
*   **One-Click Apply & Cleanup:** Automatically strips any `@` characters or redundant symbols from character names, delivering clean prompt tag output.

### 👗 3. Anima Clothing Tag Selector
*   **Clothing Prompt Gallery:** Built-in clothing and outfit prompt data with bilingual (Chinese/English) display, quick Prompt Tag copying, and one-click apply.
*   **Category & Feature Filtering:** Quickly locate items by broad categories (formal wear, casual, uniforms, swimwear, fantasy, sexy, etc.) and fine-grained features (lace, off-shoulder, thigh-highs, garter belts, etc.).
*   **Favorites & Custom Items:** Supports user-defined favorite groups, custom clothing entries, and annotation-style management to build and reuse common outfit templates.

### 💻 4. Polished Frontend UI Design
*   **3:4 Golden-Ratio Preview Cards:** Aesthetically matched to anime portraits, character art, and CG proportions, with smooth hover zoom micro-animations and shadow effects.
*   **Precise Pagination & Direct Page Jump:** The pagination controller clearly shows the current page and total records, with a direct page-number input field — just type a number and press Enter.
*   **Multi-Source CDN Smart Switching:** Provides multiple image CDN channels (`JsDelivr`, `GitHub Raw`, `Statically`), freely switchable in the panel to ensure fast sample image loading.

### 🎲 5. Anima Prompt Composer
*   **Auto-Random at Runtime:** Automatically selects random artists, characters, and clothing from the full dataset when the workflow reaches this node. User custom items are excluded.
*   **Unified String Output:** Output order is fixed as **Artist → Character → Clothing**; any category can be individually disabled. Characters support `trigger` or `trigger + tags` output modes.
*   **Collapsible Node Preview:** Displays the randomized text prompt and a 3:4 image preview directly on the node, with a toggle to collapse the preview area.

### ⚙️ 6. Smart Python Backend Concatenation (Selector Plus Nodes)
*   **Dual-Version Node Set:** Provides a standard version (Selector) and an enhanced version (Selector+).
*   **Conflict-Free Smart Concatenation:** Plus nodes support custom `extra_text` and `separator`. When two text segments are joined, the system automatically sanitizes and deduplicates them, **preventing double commas or leading/trailing spaces**, ensuring stable workflow output.

### 🌐 7. Native i18n Support
*   Supports Chinese and English, automatically detecting and following ComfyUI's native locale setting (`Comfy.Locale`) in real time — no manual configuration required.

---

## ⚙️ Installation

### Option 1: Auto-Install via ComfyUI Manager (Recommended)
1. Open the ComfyUI interface and click the **Manager** button in the bottom-right corner.
2. Select **Custom Nodes Manager**, then type `Anima Tools` in the search box.
3. Click **Install** and restart ComfyUI once the installation is complete.

### Option 2: Manual Git Clone
1. Open a terminal.
2. Navigate to your ComfyUI custom nodes directory:
   ```bash
   cd ComfyUI/custom_nodes/
   ```
3. Run the Git clone command:
   ```bash
   git clone https://github.com/nregret/Comfyui-Anima-Tools.git
   ```
4. Restart ComfyUI — the plugin will be loaded automatically.

> [!TIP]
> **Zero-Dependency Guarantee:** This plugin is built on pure front-end JavaScript and native Python. It does **not** require installing any third-party Python packages via `pip install`, so it will not affect the stability of your local virtual environment.

---

## 📖 Nodes Reference

This suite provides **8 core nodes**, located under the `AnimaArt` category:

### 1. 🎨 Anima Artist Tag Selector & Selector+
*   **Standard Version (Selector):**
    *   `artist_tags` (String): The artist list automatically populated by the front-end panel.
    *   `mode` (Combo: `append` / `override`): When an optional `opt_prompt` input is provided, determines whether the artist name is **appended** to the existing prompt or **overrides** it entirely.
    *   `opt_prompt` (String, optional): An existing prompt passed in from an external source.
*   **Enhanced Version (Selector+):**
    *   `artist_tags` (String): Auto-generated artist tags prefixed with `@`.
    *   `extra_text` (String): Additional user-defined prompt / tag text.
    *   `separator` (String, default `, `): The separator used to join the artist tag and extra text, with smart formatting error-prevention.

### 2. 🎭 Anima Character Tag Selector & Selector+
*   **Standard Version (Selector):**
    *   `character_tags` (String): The anime character tag list populated from the front-end panel selection.
    *   `mode` (Combo: `append` / `override`): External prompt concatenation mode.
    *   `opt_prompt` (String, optional): An existing prompt passed in from an external source.
*   **Enhanced Version (Selector+):**
    *   `character_tags` (String): The selected character prompt (after sanitization).
    *   `extra_text` (String): Additional custom prompt text to append.
    *   `separator` (String): Smart error-prevention separator.

### 3. 👗 Anima Clothing Tag Selector & Selector+
*   **Standard Version (Selector):**
    *   `clothing_tags` (String): The clothing prompt tags populated from the front-end panel selection.
    *   `mode` (Combo: `append` / `override`): External prompt concatenation mode.
    *   `opt_prompt` (String, optional): An existing prompt passed in from an external source.
*   **Enhanced Version (Selector+):**
    *   `clothing_tags` (String): The selected clothing prompt (after sanitization).
    *   `extra_text` (String): Additional custom prompt text to append.
    *   `separator` (String): Smart error-prevention separator.

### 4. 🎲 Anima Prompt Composer
*   `enable_artist` / `enable_character` / `enable_clothing` (Boolean): Controls whether each of the three categories participates in the output.
*   `character_detail` (Combo: `trigger` / `trigger_tags`): Controls whether the character output uses only the trigger word, or the trigger word plus full attribute tags.
*   `seed` (Int): `-1` randomizes on every run; a fixed value produces reproducible results.
*   `artist_count` (Int): Controls the number of randomly selected artists; character and clothing are each fixed at 1 random selection.
*   `preview_collapsed` (Boolean): Controls whether the random result preview on the node is collapsed.
*   Output is a single `STRING` with a fixed order of **Artist → Character → Clothing**.

### 5. 🧩 Anima Multi LoRA Loader
*   `model`: Standard ComfyUI model input.
*   `lora_list_json` (String): The LoRA list maintained by the front-end LoRA selector, containing filenames, enabled states, and model strengths.
*   The front-end panel supports local LoRA preview, Civitai search, download progress tracking, favorites, persistent thumbnail cache, and quick re-opening.

---

## 📦 Project Structure

```text
Anima-Tools/
├── __init__.py                # Plugin registration entry & front-end static web resource declarations
├── nodes.py                   # Python core backend (artist, character, clothing, prompt composer & LoRA loader)
├── anima_lora_api.py          # Civitai LoRA search, download & config persistence
├── README.md                  # Documentation (English)
├── README_ZH.md               # Documentation (Chinese)
├── js/
│   ├── anima_artist_selector.js     # Artist style visual selector — front-end panel interaction logic
│   ├── anima_character_selector.js  # Character encyclopedia selector — front-end attribute search & panel
│   ├── anima_clothing_selector.js   # Clothing prompt selector — front-end panel interaction logic
│   ├── anima_prompt_composer.js     # Artist, character & clothing random composer node preview logic
│   ├── anima_lora_selector.js       # Multi-LoRA search, download, local preview & cache panel
│   ├── anima_image_utils.js         # Shared image loading & cache utilities
│   ├── anima_promo_links.js         # Shared component for GitHub & Afdian navigation links
│   ├── data.js                      # 40,000+ detailed artist database (with CDN mapping & uniqueness scores)
│   ├── character_data.js            # Anime character multi-dimensional database (hair color, eye color, series, fan popularity)
│   ├── clothing_data.js             # Clothing prompt & preview image database
│   ├── character_official_data.json # Character official trigger words & full attribute data
│   └── i18n.js                      # Multi-language smart-routing (follows Comfy.Locale)
└── locales/
    ├── en/
    │   ├── main.json
    │   └── nodeDefs.json      # Node definitions & English localization
    └── zh/
        ├── main.json
        └── nodeDefs.json      # Node definitions & Chinese localization
```

---

## 🤝 Credits & Acknowledgement

This plugin — and its extensive, high-quality data — would not exist without the following outstanding open-source anime projects:

1.  **[AnimaDex](https://github.com/zetaneko/AnimaDex)** 🎭
    *   **Credit:** Provided a high-quality anime character database and multi-attribute encyclopedia system. The core data structure and design inspiration for the character multi-dimensional cross-filtering (gender, hair color, eye color, fan popularity, series category) originates from this project.

2.  **[Anima-Style-Explorer](https://github.com/ThetaCursed/Anima-Style-Explorer)** 🎨
    *   **Credit:** Provided the highly detailed **40,000+** Danbooru artist database that forms the solid data foundation of the Artist Style Selector.

3.  **CircleStone Labs** 🧪
    *   **Credit:** Thanks for releasing the outstanding **Anima 2B** open-source anime large model. Their pioneering exploration in the anime model space inspired us to build this efficient prompt assistant tool.

> We extend our sincere respect to all creators and developers who enrich the AI art ecosystem and contribute selflessly to the open-source community!

---

## 📄 License

This project is open-sourced under the **[MIT License](LICENSE)**. You are free to use, modify, and distribute this project, provided that you retain the original author's copyright notice and the acknowledgements above.
