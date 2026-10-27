# Anima-Tools: ComfyUI Premium Artist, Character, Clothing & LoRA Visual Selector 🎨

<p align="center">
  <img src="https://img.shields.io/github/v/release/nregret/Comfyui-Anima-Tools?color=ff69b4&style=flat-square" alt="Release">
  <img src="https://img.shields.io/badge/ComfyUI-Custom__Nodes-blueviolet?style=flat-square" alt="ComfyUI Custom Nodes">
  <img src="https://img.shields.io/badge/Database-40K+_Artists-orange?style=flat-square" alt="Artist Database">
  <img src="https://img.shields.io/badge/i18n-ZH__CN%20%7C%20EN-green?style=flat-square" alt="i18n Supported">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License">
</p>

<p align="center">
  <strong>专为 ComfyUI 设计的高性能、多维度二次元画师、角色、服装与 Anima LoRA 视觉选择套件</strong>
</p>

<p align="center">
  Anima-Tools 是一款专为二次元（Anime）AI 绘画量身打造的 ComfyUI 视觉提示词与 Anima LoRA 辅助套件。它深度融合了庞大的画师风格库、精细的动漫角色图鉴、服装提示词图库、随机提示词整合节点与 Civitai LoRA 搜索下载面板，帮助创作者以极高的自由度与精确度构建脑海中的二次元画面。
</p>

---

## LoRA 管理器

Anima Multi LoRA Loader 的节点面板与「LoRA 管理器」弹窗移植自 [CivitaiManager](https://github.com/nregret/CivitaiManager)，使用独立的接口路径、数据目录 `user/anima_tools_lora_manager/` 与样式前缀，可与 CivitaiManager 同时安装。「发现」页固定搜索 Anima 基础模型的 LoRA，「本地 LoRA」页仍可按基础模型筛选。首次启动时自动导入旧版保存的 Civitai 密钥与 LoRA 收藏；旧版的自定义下载目录不再使用，下载统一保存到 ComfyUI 第一个 `loras` 目录下的 `基础模型/分类/` 子文件夹。旧工作流的 `lora_list_json` 无需迁移。

LoRA 只从 ComfyUI 已登记的 `loras` 目录加载与下载；使用其他磁盘或目录前，请先在 `extra_model_paths.yaml` 中将其登记为 `loras` 路径并重启 ComfyUI。Civitai 密钥不会回传到浏览器，下载跳转不携带认证头。

The Anima Multi LoRA Loader panel and its LoRA Manager popup are ported from CivitaiManager and can be installed alongside it. Discover only searches Anima LoRAs. The Civitai key and LoRA favorites saved by the previous selector are imported on first start; the old custom download directory is no longer used; downloads go to `<base model>/<category>/` under the first registered `loras` directory. LoRAs are loaded and downloaded only within ComfyUI's registered `loras` directories, saved Civitai keys are never returned to the browser, and download redirects do not forward credentials.

## 🖼️ 视觉预览 (Visual Preview)

> [!NOTE]
> 以下为本套件实际运行时的交互界面截图。安装后即可在 ComfyUI 中获得完全一致的视觉交互体验。

<table>
  <tr>
    <td align="center" width="50%">
      <strong>🎨 画师风格选择面板 (Artist Style Selector Panel)</strong><br>
      <img src="./img/artist.jpeg" alt="Anima Artist Style Selector UI Preview"><br>
      <em>图 1. 4万+画师风格库预览，支持独特度与作品数检索排序</em>
    </td>
    <td align="center" width="50%">
      <strong>🎭 角色属性图鉴面板 (Character Tag Selector Panel)</strong><br>
      <img src="./img/character.jpeg" alt="Anima Character Selector UI Preview"><br>
      <em>图 2. 多维属性动漫角色图鉴，支持发色、瞳色与同人热度多维交叉过滤</em>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>🧩 Anima LoRA 加载面板 (Anima LoRA Loader Panel)</strong><br>
      <img src="./img/lora.jpeg" alt="Anima LoRA Loader UI Preview"><br>
      <em>图 3. Anima LoRA 搜索、预览、下载、收藏、已加载管理与持久缩略图缓存面板</em>
    </td>
    <td align="center" width="50%">
      <strong>⚙️ ComfyUI 节点示意图 (Workflow & Node Layout)</strong><br>
      <img src="./img/nodes.jpeg" alt="ComfyUI Node Layout Preview"><br>
      <em>图 4. 标准版、Plus 版与 Anima Multi LoRA Loader 节点拼装工作流示意图</em>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>👗 服装标签选择面板 (Clothing Tag Selector Panel)</strong><br>
      <img src="./img/clothing.jpeg" alt="Anima Clothing Selector UI Preview"><br>
      <em>图 5. 占位图：服装提示词图库预览，支持分类、特征、收藏与自定义项管理</em>
    </td>
    <td align="center" width="50%">
      <strong>🎲 随机提示词整合节点 (Prompt Composer Node Preview)</strong><br>
      <img src="./img/prompt_composer.jpeg" alt="Anima Prompt Composer Node Preview"><br>
      <em>图 6. 占位图：运行工作流时随机组合画师、角色与服装，并在节点上显示结果预览</em>
    </td>
  </tr>
</table>

---

## 🗺️ 目录 (Table of Contents)
- [✨ 核心功能 (Core Features)](#-核心功能-core-features)
- [⚙️ 安装指南 (Installation)](#-安装指南-installation)
- [📖 节点参数说明 (Nodes Reference)](#-节点参数说明-nodes-reference)
- [📦 项目架构 (Project Structure)](#-项目架构-project-structure)
- [🤝 鸣谢与致敬 (Credits & Acknowledgement)](#-鸣谢与致敬-credits--acknowledgement)
- [📄 开源协议 (License)](#-开源协议-license)

---

## ✨ 核心功能 (Core Features)

### 🎨 1. 画师风格视觉选择器 (Anima Artist Style Selector)
*   **画师底座数据：** 完整收录 **40,000+** Danbooru 精选画师风格（数据基于 [Anima-Style-Explorer](#-鸣谢与致敬-credits--acknowledgement)），支持前端高效检索。
*   **多维检索与排序：** 支持画师名模糊搜索，并可按**作品数量 (Works Count)**、**独特度分数 (Uniqueness Score)** 以及 **字母顺序 (A-Z / Z-A)** 进行快速排序，助你精准定位小众或热门风格。
*   **智能 @ 格式规范化：** 无论在前端交互还是后端 Python 节点，插件都会自动将选中的画师格式化为以 `@` 符号前缀的标准标签（例如选中 `dairi`，自动包装为 `@dairi`），并自动清除多余的 `by ` 或已存在的冗余符号。

### 🎭 2. 动漫角色图鉴选择器 (Anima Character Tag Selector)
*   **多属性高级图鉴：** 深度融合二次元角色百科（数据基于 [AnimaDex](#-鸣谢与致敬-credits--acknowledgement)），内置海量经典与热门动漫角色。
*   **多维度交叉筛选：** 提供**分类浏览面板**，支持按**角色性别**、**发色 (Hair Color)**、**瞳色 (Eye Color)**、**同人热度（插画总数）** 以及 **动漫原作系列 (Hot Series)** 进行交叉检索。
*   **两种应用方式：** 可只应用角色触发词，或应用触发词加该角色的官方特征 Tags。

### 👗 3. 服装标签视觉选择器 (Anima Clothing Tag Selector)
*   **服装提示词图库：** 内置服装与穿搭相关提示词数据，支持中英双语展示、Prompt Tags 快速复制与一键应用。
*   **分类与特征筛选：** 支持按礼服、日常、制服、泳装、奇幻、性感等大类，以及蕾丝、露肩、长靴、吊袜带等细分特征快速定位。
*   **收藏与自定义项：** 支持用户收藏分组、自定义服装项与备注式管理，便于沉淀常用穿搭模板。

### 💻 4. 统一的选择器界面 (Unified Selector UI)
*   **一个按钮打开全部选择器：** Anima Prompt / Anima Prompt Plus 节点上只有一个「打开提示词选择器」按钮，弹窗顶部可在画师、角色、服装、姿势、背景之间切换，切换时保留各分区已选内容；应用时只把有改动的分区写回对应输入框。弹窗会记住上次使用的分区。
*   **统一弹窗布局：** 画师、角色、服装、背景、姿势五个选择器共用同一套界面：左侧「全部 / 收藏夹 / 已选择」导航、可折叠的筛选面板、卡片网格与右侧详情面板，配色跟随 ComfyUI 明暗主题。
*   **多选与详情：** 点击卡片即可多选；卡片上的详情按钮可只查看大图、提示词（点击复制）、收藏分组与备注而不改变选择。
*   **精准分页与页码直达：** 分页栏显示当前范围与总数，输入页码按回车即可直达。
*   **多源图片回退：** 画师样图依次尝试 Animadex、JsDelivr、GitHub Raw 与 Statically，加载失败时自动切换。

### 🎲 5. 随机提示词整合节点 (Anima Prompt Composer)
*   **运行时自动随机：** 工作流运行到节点时自动从全量画师、角色、服装、背景与姿势数据中随机选择内容，不包含用户自定义项。
*   **统一字符串输出：** 输出顺序固定为 **画师 -> 角色 -> 服装 -> 背景 -> 姿势**，可单独禁用任意类别。
*   **角色触发词 × 特征 Tags 随机组合：** 角色支持 `trigger`、`trigger_tags` 与 `trigger_random_tags` 三种模式。随机组合模式会剔除 `1boy` / `1girl` 等性别词以及发色、瞳色词后再随机抽取，可组合数量比原来高一个数量级。
*   **保留角色身份特征：** 发色 / 瞳色等特征词会固定跟在触发词后面（同属性的冲突颜色只保留一个），并且不携带性别，方便做男女性转玩法。
*   **服装多来源随机搭配：** 服装可来自内置图库、Danbooru 标签组或其它角色的 Tags。Danbooru 路径会从 **上装 + 下装 / 制服 / 传统服饰** 中三选一作为主服装，再叠加装饰、袜子与鞋子，避免穿搭自相冲突。
*   **角色与服装种子可分离：** 主 `seed` 之外可单独设置角色种子与服装种子，锁定其中一项、另一项继续重抽。
*   **节点内可折叠预览：** 节点上直接显示随机结果的文字提示词与 3:4 图片预览，并支持折叠隐藏预览区域。

### ⚙️ 6. 提示词整合节点 (Anima Prompt / Anima Prompt Plus)
*   **分区编辑统一拼接：** 质量提示词、画师、角色、服装、姿势、背景与额外提示词分区编辑，按固定顺序拼接，并自动避免双逗号与多余空格。
*   **按分区随机：** 节点上的「随机」开关可让任意分区在每次运行时自动随机一项。

### 🌐 7. 原生多语言跟随 (Native i18n)
*   支持中英双语，自动识别并实时跟随 ComfyUI 原生的多语言设置（`Comfy.Locale`），无需手动配置。

---

## ⚙️ 安装指南 (Installation)

### 方式一：通过 ComfyUI Manager 自动安装 (推荐)
1. 打开 ComfyUI 界面，点击右下角的 **Manager** 按钮。
2. 选择 **Custom Nodes Manager**，在搜索框中输入 `Anima Tools`。
3. 点击 **Install**，等待安装完成后重新启动 ComfyUI。

### 方式二：手动 Git 克隆安装
1. 打开终端。
2. 进入您的 ComfyUI 自定义节点目录：
   ```bash
   cd ComfyUI/custom_nodes/
   ```
3. 执行 Git 克隆指令：
   ```bash
   git clone https://github.com/nregret/Comfyui-Anima-Tools.git
   ```
4. 重新启动 ComfyUI 即可自动加载。

> [!TIP]
> **零依赖保证：** 本插件基于纯前端 JavaScript 交互与原生 Python 开发，**不需要**通过 `pip install` 安装任何额外的第三方 Python 库，不影响您的本地虚拟环境稳定性。

---

## 📖 节点参数说明 (Nodes Reference)

本套件共提供 4 个节点，放置于 `AnimaArt` 分类目录下：

### 1. 🧩 Anima Prompt & Anima Prompt Plus (提示词整合)
*   `quality_prompt` / `artist_tags` / `character_tags` / `clothing_tags` / `pose_tags` / `background_tags` / `extra_prompt` (String): 各分区提示词，Tag 分区可通过「打开提示词选择器」填入，也可以手动修改。画师会统一整理为 `@画师名` 格式。
*   `separator` (String, 默认 `, `): 各分区之间的分隔符。
*   **随机开关：** 节点底部「随机」一行可单独开启画师、角色、服装、姿势、背景的运行时随机。
*   **Anima Prompt** 输出 `STRING`；**Anima Prompt Plus** 额外需要 `clip` 输入，输出 `CONDITIONING` 与拼接后的文本。

> [!NOTE]
> 旧版的单类选择器节点（Artist / Character / Clothing / Background / Pose Tag Selector 及其 `+` 版本）已移除，旧工作流中的这些节点需替换为 Anima Prompt 或 Anima Prompt Plus。

### 2. 🎲 Anima Prompt Composer (随机提示词整合器)
*   `enable_artist` / `enable_character` / `enable_clothing` / `enable_background` / `enable_pose` (Boolean): 控制画师、角色、服装、背景、姿势五个类别是否参与输出。
*   `character_detail` (Combo: `trigger` / `trigger_tags` / `trigger_random_tags`):
    *   `trigger`: 只输出角色触发词。
    *   `trigger_tags`: 输出触发词加该角色全部特征 Tags。
    *   `trigger_random_tags`: 输出触发词 + 随机抽取的部分特征 Tags，用于大幅扩展可组合数量。
*   `seed` (Int): `-1` 表示每次运行自动随机；固定数值可获得可复现结果。
*   `artist_count` (Int): 控制随机画师数量；角色、服装、背景与姿势固定各随机 1 个。
*   `character_seed` / `clothing_seed` (Int): `-1` 表示跟随主 `seed`，固定数值可单独锁定角色或服装，让另一项继续重抽。
*   `character_tag_count` (Int): `trigger_random_tags` 模式下随机抽取的特征 Tags 数量。
*   `character_keep_features` (Boolean): 是否把发色、瞳色等身份特征词固定跟在触发词后面（同属性的冲突颜色只保留一个，性别词始终不带）。
*   `clothing_source` (Combo: `author` / `danbooru` / `character_tags` / `random`):
    *   `author`: 使用内置服装图库（默认，保持原有行为）。
    *   `danbooru`: 从 Danbooru 标签组中随机搭配服装。主服装在 **上装 + 下装 / 制服 / 传统服饰** 中三选一，再叠加装饰、袜子与鞋子。`uniform` / `traditional` 两个主服装池只保留整套服装，`geta`、`tabi`、`hood`、`cape`、`haori` 等单件与配饰已归入对应的鞋袜 / 上衣 / 配饰槽，不会再被当成整套服装而出现「没有主服装」或「两双鞋」的搭配。
    *   `character_tags`: 借用其它角色官方 Tags 中属于服装的词。
    *   `random`: 每次运行在以上三种来源中随机挑一种。
*   `preview_collapsed` (Boolean): 控制节点上的随机结果预览是否折叠。
*   输出为单个 `STRING`，顺序固定为 **画师 -> 角色 -> 服装 -> 背景 -> 姿势**。

> [!NOTE]
> 新增参数一律追加在 `resolved_prompt` 之后，因此旧工作流的 `widgets_values` 位置保持不变，升级后行为与升级前一致。
>
> 这些新增输入同时是**可选输入**（`optional`）而非必填：ComfyUI 校验时会对 `INPUT_TYPES` 中缺失的 `required` 输入报 `required_input_missing`，Python 参数默认值无法绕过该校验，所以若放在 `required`，3.2.9 保存的 API 工作流会直接校验失败。放在 `optional` 后，缺失时由节点签名在运行时补默认值，旧 API 工作流照常可用。

### 3. 🧩 Anima Multi LoRA Loader (多 LoRA 加载器)
*   `model`: ComfyUI 标准模型输入。
*   `lora_list_json` (String): LoRA 管理器维护的 LoRA 列表，包含文件名、所在目录、启用状态与模型强度。
*   节点面板可调整强度、启用或移除 LoRA；「LoRA 管理器」弹窗提供 Anima LoRA 发现与下载、本地 LoRA、收藏夹、已应用排序与下载任务。

---

## 📦 项目架构 (Project Structure)

```text
Anima-Tools/
├── __init__.py                # 插件注册入口与前端静态 Web 资源声明
├── nodes.py                   # Python 核心后端（包含画师、角色、服装、随机整合等）
├── lora_manager/              # LoRA 管理器后端与 Multi LoRA Loader 节点（移植自 CivitaiManager）
├── README.md                  # 说明文件
├── js/
│   ├── anima_gallery_selector.js    # 画师/角色/服装/背景/姿势选择器共用弹窗（导航、筛选、卡片、详情、分页、收藏）
│   ├── anima_artist_selector.js     # 画师选择器数据适配（图片源、排序、@ 输出格式）
│   ├── anima_character_selector.js  # 角色选择器数据适配（属性筛选、官方触发词与 Tags）
│   ├── anima_tag_selectors.js       # 服装、背景、姿势选择器数据适配（分类、特征、中英双语）
│   ├── anima_prompt_plus.js         # Anima Prompt 节点：提示词选择器按钮与随机开关
│   ├── anima_prompt_composer.js     # 画师、角色、服装随机整合节点预览逻辑
│   ├── anima_lora_node.js           # Multi LoRA Loader 节点面板与 LoRA 管理器弹窗
│   ├── lora_manager/                # LoRA 管理器共享模块（接口、卡片、详情、下载、收藏、样式、主题取色）
│   ├── anima_selector_ui.js         # 选择器共享样式（跟随 ComfyUI 主题）、图标与对话框等基础组件
│   ├── anima_image_utils.js         # 共享图片加载缓存工具
│   ├── anima_promo_links.js         # GitHub 与爱发电链接
│   ├── data.js                      # 40,000+ 详尽画师数据库 (含 CDN 映射与独特度评分)
│   ├── character_data.js            # 动漫角色发色、瞳色、作品系列、同人热度多维数据库
│   ├── clothing_data.js             # 服装提示词与预览图数据库
│   ├── character_official_data.json # 角色官方触发词与完整特征数据
│   ├── danbooru_attire_data.json    # Danbooru 服装标签组（装饰/上装/下装/袜子/鞋子/制服/传统服饰）
│   └── i18n.js                      # 多语言智能切换路由 (跟随 Comfy.Locale)
├── tools/
│   └── fetch_danbooru_attire.py     # 从 Danbooru 标签组 Wiki 重新生成服装标签数据
└── locales/
    ├── en/
    │   ├── main.json
    │   └── nodeDefs.json      # 节点定义与英文本地化翻译
    └── zh/
        ├── main.json
        └── nodeDefs.json      # 节点定义与中文本地化翻译
```

---

## 🤝 鸣谢与致敬 (Credits & Acknowledgement)

本插件能够诞生并具备如此庞大且详实的数据支撑，离不开以下杰出的二次元开源项目：

1.  **[AnimaDex](https://github.com/zetaneko/AnimaDex)** 🎭
    *   **致谢理由：** 提供了优质的动漫角色数据库与多维属性图鉴系统。本插件的角色多维度检索筛选（性别、发色、瞳色、同人热度、系列分类）核心数据结构与设计灵感来源于此。
2.  **[Anima-Style-Explorer](https://github.com/ThetaCursed/Anima-Style-Explorer)** 🎨
    *   **致谢理由：** 提供了非常详尽的 **40,000+** Danbooru 画师数据库，让画师风格选择器拥有了坚实的数据根基。
3.  **[Danbooru](https://danbooru.donmai.us/wiki_pages/tag_group%3Aattire)** 👗
    *   **致谢理由：** 提供了社区维护的服装标签组 Wiki（`tag group:attire`），本插件 Danbooru 服装搭配路径的分类与标签池均来源于此。
4.  **CircleStone Labs** 🧪
    *   **致谢理由：** 感谢推出杰出的 **Anima 2B** 开源二次元大模型，正是由于该模型在二次元大模型领域的探索，激发了我们打造这款高效率提示词辅助工具的灵感。

> 我们对所有致力于丰富 AI 绘画生态、为开源社区无私奉献的创作者和开发者们致以诚挚的敬意！

---

## 📄 开源协议 (License)

本项目基于 **[MIT License](LICENSE)** 协议开源。您可以自由地使用、修改和分发本项目，但请保留原作者的版权声明与上述致谢声明。
