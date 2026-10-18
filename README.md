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

## 3.3.1 LoRA 安全更新

LoRA 加载和下载仅接受 `.safetensors`，文件必须位于 ComfyUI 已登记的 LoRA 目录中。使用其他磁盘或目录前，请先在 ComfyUI 的 `extra_model_paths.yaml` 中将其登记为 `loras` 路径，然后重启 ComfyUI。设置面板仍可选择这些目录及其已有子目录。

Civitai 密钥不会回传到浏览器；保留掩码不编辑即可继续使用已保存密钥，清空密钥输入框并保存可删除密钥。下载跳转不携带认证头，远程 LoRA 预览仅接受 Civitai 图片地址。

LoRA loading and downloading require `.safetensors` files within directories registered with ComfyUI. Register other locations under `loras` in `extra_model_paths.yaml` and restart ComfyUI before selecting them. Saved Civitai keys are never returned to the browser; leave the masked field unchanged to keep a key, or clear it and save to remove it. Download redirects do not forward credentials, and remote LoRA previews only accept Civitai image URLs.

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
*   **一键应用与清理：** 自动清理角色名字中可能带有的 `@` 字符或多余符号，提供纯净的 Prompts 角色标签输出。

### 👗 3. 服装标签视觉选择器 (Anima Clothing Tag Selector)
*   **服装提示词图库：** 内置服装与穿搭相关提示词数据，支持中英双语展示、Prompt Tags 快速复制与一键应用。
*   **分类与特征筛选：** 支持按礼服、日常、制服、泳装、奇幻、性感等大类，以及蕾丝、露肩、长靴、吊袜带等细分特征快速定位。
*   **收藏与自定义项：** 支持用户收藏分组、自定义服装项与备注式管理，便于沉淀常用穿搭模板。

### 💻 4. 规范的前端交互设计 (Frontend UI Design)
*   **3:4 黄金比例预览卡片：** 贴合动漫人像、立绘和 CG 的美学比例。带有平滑的 Hover 缩放微动效以及阴影表现。
*   **精准分页与页码直达：** 分页控制器直观显示当前页数与总记录。特设页码直接跳转输入框，输入页码按回车即可直达。
*   **多源 CDN 智能切换：** 提供 `JsDelivr`、`GitHub Raw` 和 `Statically` 等多条图片 CDN 通道，用户可在面板中自由切换，确保样图快速加载。

### 🎲 5. 随机提示词整合节点 (Anima Prompt Composer)
*   **运行时自动随机：** 工作流运行到节点时自动从全量画师、角色、服装、背景与姿势数据中随机选择内容，不包含用户自定义项。
*   **统一字符串输出：** 输出顺序固定为 **画师 -> 角色 -> 服装 -> 背景 -> 姿势**，可单独禁用任意类别。
*   **角色触发词 × 特征 Tags 随机组合：** 角色支持 `trigger`、`trigger_tags` 与 `trigger_random_tags` 三种模式。随机组合模式会剔除 `1boy` / `1girl` 等性别词以及发色、瞳色词后再随机抽取，可组合数量比原来高一个数量级。
*   **保留角色身份特征：** 发色 / 瞳色等特征词会固定跟在触发词后面（同属性的冲突颜色只保留一个），并且不携带性别，方便做男女性转玩法。
*   **服装多来源随机搭配：** 服装可来自内置图库、Danbooru 标签组或其它角色的 Tags。Danbooru 路径会从 **上装 + 下装 / 制服 / 传统服饰** 中三选一作为主服装，再叠加装饰、袜子与鞋子，避免穿搭自相冲突。
*   **角色与服装种子可分离：** 主 `seed` 之外可单独设置角色种子与服装种子，锁定其中一项、另一项继续重抽。
*   **节点内可折叠预览：** 节点上直接显示随机结果的文字提示词与 3:4 图片预览，并支持折叠隐藏预览区域。

### 🎲 6. 随机 Danbooru 图 + 标签 (Anima Danbooru Random Image)
*   **出图与标签成对输出：** 从 Danbooru 按 `query_tags` 随机抽一张**静态**图，同时把它自己的标签按 Anima 写法分组输出（下划线转空格、小写、去重、英文逗号 + 空格连接、画师加 `@` 前缀），出图与提示词一次拿齐，直接喂 `CLIPTextEncode`。
*   **可复现随机：** `seed = -1` 每次运行重新抽；给定固定 seed 时由「**作品 id 锚点 + id 窗口**」推导（**不是页码**——站点默认新帖在前，一次上传就会把整页往后推），窗口**截止于锚点**，所以同一 seed 稳定复现，且此后新增的作品（id 一定更大）落不进这个窗口。
*   **守标签限额与抓取礼仪：** 默认 `rating:general`（`rating:*` 不计入标签数，固定 seed 追加的 `id:*` 窗口同样不占名额）、默认屏蔽 `artist_name` / `watermark` 等上传噪声标签、默认取 `sample` 档；动图与非静态帖改由客户端筛掉重试，**不用会占名额的 `-animated`**。
*   **本地缓存与网络兜底：** 图片按「档位 + md5」落到 `input/danbooru_cache` 复用（换 `size` 不会拿旧档顶替，缓存超过 500 个只清自己写的旧文件）；请求只用标准库（守 `dependencies = []`），DNS 被污染时用内置 Cloudflare 地址兜底（仅在正常请求失败时启用）。

### ⚙️ 7. 智能 Python 后端拼接 (Selector Plus Nodes)
*   **双版本节点组合：** 提供基础版 (Selector) 与 Plus 版 (Selector+)。
*   **智能防冲突拼接：** Plus 节点支持自定义 `extra_text`（额外文本）与 `separator`（分隔符）。当两段文本拼合时，系统会自动进行去污与去重，**避免产生双逗号或首尾多余空格**的排版问题，保证工作流稳定。

### 🌐 8. 原生多语言跟随 (Native i18n)
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

本套件共提供 8 个核心节点，放置于 `AnimaArt` 分类目录下：

### 1. 🎨 Anima Artist Tag Selector & Selector+ (画师选择器)
*   **基础版 (Selector):**
    *   `artist_tags` (String): 前端交互界面自动填入的画师列表。
    *   `mode` (Combo: `append` / `override`): 在提供可选输入 `opt_prompt` 时，画师名是**追加**到已有提示词后面还是直接**覆盖**输出。
    *   `opt_prompt` (String, 可选输入): 外部传入的已有提示词。
*   **增强版 (Selector+):**
    *   `artist_tags` (String): 自动生成的以 `@` 开头的画师标签。
    *   `extra_text` (String): 用户自定义写入的额外 Prompts / Tag 文本。
    *   `separator` (String, 默认 `, `): 连接画师与额外提示词的分隔符，具有智能排版防错机制。

### 2. 🎭 Anima Character Tag Selector & Selector+ (角色选择器)
*   **基础版 (Selector):**
    *   `character_tags` (String): 前端交互选择填入的动漫角色 Tag 列表。
    *   `mode` (Combo: `append` / `override`): 外部 Prompt 拼接模式。
    *   `opt_prompt` (String, 可选输入): 外部传入的已有提示词。
*   **增强版 (Selector+):**
    *   `character_tags` (String): 选择的角色提示词（去污处理后）。
    *   `extra_text` (String): 追加的自定义提示词。
    *   `separator` (String): 智能防错连接符。

### 3. 👗 Anima Clothing Tag Selector & Selector+ (服装选择器)
*   **基础版 (Selector):**
    *   `clothing_tags` (String): 前端交互选择填入的服装 Prompt Tags。
    *   `mode` (Combo: `append` / `override`): 外部 Prompt 拼接模式。
    *   `opt_prompt` (String, 可选输入): 外部传入的已有提示词。
*   **增强版 (Selector+):**
    *   `clothing_tags` (String): 选择的服装提示词（去污处理后）。
    *   `extra_text` (String): 追加的自定义提示词。
    *   `separator` (String): 智能防错连接符。

### 4. 🎲 Anima Prompt Composer (随机提示词整合器)
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
>
> 与 3.2.9 之前保存的工作流互通时另有一个坑：前端把「没有值的 widget」序列化成 `null`，而 `widgets_values` 是按位置恢复的 —— 旧工作流数组更短，新追加的 widget 就会拿到 `null`，`character_seed: null` 会让 ComfyUI 在节点运行前就拒绝整个队列（`Failed to convert an input value to a INT value: character_seed, None`）。本版本已在两处兜底：前端加载节点时把 `null` 还原成默认值并在下次保存时写回，服务端排队钩子也会在 ComfyUI 校验前修好这类值，因此打开旧工作流**不需要手动补值**。

### 5. 🧩 Anima Multi LoRA Loader (多 LoRA 加载器)
*   `model`: ComfyUI 标准模型输入。
*   `lora_list_json` (String): 前端 LoRA 选择器维护的 LoRA 列表，包含文件名、启用状态与模型强度。
*   前端面板支持本地 LoRA 预览、Civitai 搜索、下载进度、收藏、持久缩略图缓存与快速二次打开。

### 6. 🎲 Anima Danbooru Random Image (随机 Danbooru 图 + 标签)

从 Danbooru 随机抽一张图，并把它的标签按 Anima 的写法分组输出（`_` 转空格、小写、去重、英文逗号 + 空格连接、画师加 `@` 前缀），既能喂给 `CLIPTextEncode` 当提示词灵感，也能当参考图。

*   `query_tags` (String): 查询标签，默认 `rating:general`。空格或逗号都能分隔；**匿名与免费账号最多 2 个标签**，其中 `rating:*` 与 `id:*` 不占名额，而 `random:1`、`order:*` 与 `-tag` 占名额（站点源码 `PostQuery::UNLIMITED_METATAGS` 里列着 `rating`/`id`，没有 `order`/`random`；官方等级表：匿名 2 / 免费会员 2 / Gold 6 / Platinum 不限）。超限时 Danbooru 返回 `TagLimitError`，节点会把原文和提示一起报出来。**想看多档就写 `rating:general,sensitive,explicit`** —— Danbooru 把这种逗号列表当成「任一档即可」的**单个**查询词（也支持缩写 `rating:g,s,e`，而且**一个标签名额都不占**：实测 `1girl rating:g,s,e` 能用，`1girl solo random:1` 会被 422 拒），节点会把它原样保留、不会被逗号拆成多个标签；不写 `rating:` 时站点默认**四档**全含（Danbooru 还有 `questionable`/`q`，想连它一起抽就写 `rating:g,s,e,q`），但本节点会把空输入兜底成 `rating:general`（安全默认）。注意各档是按帖子实际数量抽的，不是均分。
*   `seed` (Int): `-1` = 每次运行重新抽（真随机，覆盖全库）；固定值 = 由种子推导**作品 id 锚点**（`sha1("danbooru-seed:<seed>:<attempt>") % id_ceiling + 1`），再取「**该 id 及以下最近的一张**符合 query 的帖子」，**可复现**。**为什么不用页码**：`/posts.json` 默认新帖在前，站点每上传一批作品就把所有页整体往后推，同一个「第 N 页第 M 条」几周后必然指向别的作品（旧版就是这样失去复刻能力的）；id 只增不减、永不复用，所以锚点不会被挤走。**窗口为什么截止于锚点、又按 id 最大取**：上传的作品 id 一定比锚点大、落在窗口之外，永远挤不进来；而站点一次请求的 `limit` 上限丢的是**最旧**的那几条 id —— 取最新的那条，正好在截断碰不到的一头（反过来「从锚点往后找、取最小 id」，宽窗口被截断后就只剩「窗口里最新 200 条中最旧的那条」，新帖或删帖都会让它漂）。锚点附近没有匹配时，先在**同一锚点**把窗口向前逐级放大（200 → 2,000 → 20,000 → 200,000），再按固定规则换下一个锚点（最多 `max_attempts` 个），整个过程仍是 seed 的纯函数，不会变成「随便再抽一张」；一次网络级失败也只会**重问同一个窗口**，不会靠换窗口把结果换掉。外接（链接）种子交给 ComfyUI 自身的缓存签名判断。
*   `size` (Combo: `sample` / `original` / `720x720` / `360x360` / `180x180`): 默认 `sample`；原图常有 5MB+ 的超大分辨率，参考用途建议保持 `sample`。**缓存按「档位 + md5」分别存**，换档会真的重新下载该档，不会拿旧档顶替。
*   `tag_character` / `tag_copyright` / `tag_general` (Boolean): 默认开启，分别对应 `tag_string_character` / `_copyright` / `_general`。
*   `tag_artist` (Boolean): 默认关闭；开启后画师标签自动加 `@` 前缀（Anima 的画师写法）。
*   `tag_meta` (Boolean): 默认关闭。meta 基本是上传元信息（`highres`、`character_request` 等），放进提示词没有好处。
*   `block_tags` / `use_default_blocklist` (String / Boolean): 默认屏蔽 `artist_name`、`character_request`、`commentary_request`、`bad_id`、`watermark`、`english_text` 等「描述上传」而非「描述画面」的标签；可追加自己的屏蔽词，或整体关掉。**每行/每个逗号一个标签**（空格不切分，所以 `black hair` 与 `black_hair` 都表示同一个标签）。**支持通配符**：`*` 匹配任意长度（含空），`?` 匹配恰好一个字符 —— `*censor*` 一条就能同时过滤 `bar censor` 和 `censored`，`hair*` / `*hair` 分别卡开头和结尾；**不带通配符的条目仍是整词匹配**（写 `smile` 不会误伤 `smiley`）。
*   `login` / `api_key` (String): 可选。留空则读环境变量 `DANBOORU_LOGIN` / `DANBOORU_API_KEY`（**不要写进工作流**，也不发给 CDN）。API key 能解锁被审查（censored）标签、读写收藏，但**不会提升标签数量上限**。
*   `max_attempts` / `timeout` / `cache_dir`: 重试次数（真随机模式 = 重抽次数；固定 seed = 最多换几个 id 锚点）、单次请求超时、图片缓存目录（默认 `input/danbooru_cache`）。整次运行另有总预算 `timeout × max_attempts`（默认 60 秒），用尽即报错而不是继续干等；**读超时 / 连接中途断开也算一次网络级失败**，会在剩余尝试与预算内重试（不是一次卡住就整轮失败），而且重试的是**同一个窗口**。缓存文件名是 `<档位>-<md5>.<ext>`，只保留最新 **500** 个（只清理本节点写的文件）。
*   `id_ceiling` (Int): 固定 seed 的**采样空间上限**，默认 `12,500,000`（2026-10-18 站点最大作品 id 为 `12,401,582`）。它必须**刚好略高于当前最大 id**：留的那一小截空区会随站点上传自动补满；设成远大于现有作品数（如 2³¹）会让绝大多数 seed 永久落空、只能空转重试（以 12.4M 为真实上限时，`12.5M` 的空区 0.8%，`2³¹` 是 99.4%）。窗口是往锚点**以下**找的，所以锚点只比当前最大 id 高一点时仍会落到最近的作品上；真正空转的是比最宽窗口（20 万 id）还高的那一截。调大 = 换了随机空间，**旧 seed 的对应关系会全部重排**；工作流里保存的是当时的值，所以不会因为我们以后调默认值而悄悄变化。固定 seed 只在这个空间内采样，之后的新作品只能用 `seed = -1` 抽到。
*   输出：`image` (IMAGE)、`artist` / `character` / `copyright` / `general`（分组标签字符串）、`prompt`（按 **画师 → 角色 → 作品 → 其余 → meta** 顺序拼好的整串）、`meta`（JSON：id / rating / score / source / 图片地址 / 是否命中缓存 等）。
*   只取静态图：`file_ext` 只接受 jpg/jpeg/png/webp/gif，带 `animated` / `video` 标签的帖子直接跳过（**刻意不用 `-animated` 排除**，因为那会占掉一个标签名额）。
*   网络兜底：本网络下 `danbooru.donmai.us` 会被错误解析（实测拿到 Dropbox 段的地址、请求超时），节点内置了实测可用的 Cloudflare 地址，**仅在正常请求失败时**启用（连接仍按真实域名做 SNI 与证书校验）；也可以把域名交给启动层的 hosts 钉定（`launch/dns.py`，3.1.1 起启动即钉）。**读超时（连上了但响应体不再往外送）同样算连接级失败**，一样会去试内置 IP，并在报错里说明「多少秒内没读完、把 timeout 调大」，不再抛裸的 `The read operation timed out`。⚠️ **第一次请求仍会白等一个 `timeout`**（DNS 投毒：解析成功但连不上），之后同一进程会记住该域名的兜底路线，不再重复等待（若该兜底地址被站点 **403/429** 拦下，节点会自动交回正常解析再试一次，避免一个被挑战的地址把域名永久钉死）；想连第一次也省掉，就把 `timeout` 调到 `6~10`，或让启动层先钉 hosts。
*   零第三方依赖：请求只用标准库，Pillow / torch 仅在 ComfyUI 运行时用于解码。

> [!NOTE]
> `robots.txt` 禁止抓取 `/*.json`，所以本节点刻意把请求压到最低：命中常规情况（真随机一次抽中、或固定 seed 的第一个窗口就有结果）是 **1 次搜索 + 1 次图片**（图片命中缓存则只要 1 次）；只有真随机抽到视频/动图、或固定 seed 的锚点附近为空才会追加搜索，且都受 `timeout × max_attempts` 总预算约束。不做批量预抓，默认只取 `rating:general`。

---

## 📦 项目架构 (Project Structure)

```text
Anima-Tools/
├── __init__.py                # 插件注册入口与前端静态 Web 资源声明
├── nodes.py                   # Python 核心后端（包含画师、角色、服装、随机整合与 LoRA 加载等）
├── anima_lora_api.py          # Civitai LoRA 搜索、下载与配置持久化
├── README.md                  # 说明文件
├── js/
│   ├── anima_artist_selector.js     # 画师风格视觉选择器前端核心面板交互逻辑
│   ├── anima_character_selector.js  # 角色图鉴选择器前端核心属性检索与交互面板
│   ├── anima_clothing_selector.js   # 服装提示词选择器前端核心面板交互逻辑
│   ├── anima_prompt_composer.js     # 画师、角色、服装随机整合节点预览逻辑
│   ├── anima_lora_selector.js       # 多 LoRA 搜索、下载、本地预览与缓存面板
│   ├── anima_lora_node_widgets.js   # LoRA 节点内启用开关、名称与移除控制条
│   ├── anima_selector_ui.js          # 选择器共享 UI 基础组件、设计令牌与图库样式骨架
│   ├── anima_image_utils.js         # 共享图片加载缓存工具
│   ├── anima_promo_links.js         # GitHub 与爱发电跳转入口共享组件
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
