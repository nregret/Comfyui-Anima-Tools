import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";
import { markImageLoaded, isImageLoaded } from "./anima_image_utils.js";
import { createPromoLinks } from "./anima_promo_links.js";
import { addSelectorActionRow, installSelectorExecutionSync } from "./anima_selector_random.js";

app.registerExtension({
    name: "AnimaArtistTagSelector.extension",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "AnimaArtistTagSelector" || nodeData.name === "AnimaArtistTagSelectorPlus" || nodeData.name === "AnimaPromptPlus") {
            installSelectorExecutionSync(nodeType);
            const origOnCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                origOnCreated?.apply(this, arguments);

                // 找到 artist_tags widget
                const artistTagsWidget = this.widgets.find(w => w.name === "artist_tags");
                if (!artistTagsWidget) return;
                
                addSelectorActionRow(this, {
                    section: "artist",
                    label: t("Open Artist Selector"),
                    accent: "#0b8ce9",
                    accentText: "#7dd3fc",
                    onOpen: async () => {
                        if (!window.galleryData) {
                            alert(t("Anima artist database is loading, please wait a few seconds..."));
                            return;
                        }
                        await openArtistSelectorModal(this, artistTagsWidget);
                    },
                });
            };
        }
    }
});

async function openArtistSelectorModal(node, tagsWidget) {
    // 1. 解析当前节点中已经选中的 tags，兼容 @ 前缀和 by 前缀
    const currentTagsText = tagsWidget.value || "";
    const cleanArtistToken = (value) => {
        let clean = String(value || "").trim();
        if (clean.startsWith("@")) {
            clean = clean.substring(1).trim();
        } else if (clean.toLowerCase().startsWith("by ")) {
            clean = clean.substring(3).trim();
        }
        return clean;
    };
    const currentTokenSet = new Set(
        currentTagsText.split(",")
            .map(token => cleanArtistToken(token).toLowerCase())
            .filter(Boolean)
    );
    const selectedArtists = new Set(
        currentTagsText.split(",")
            .map(cleanArtistToken)
            .filter(t => t.length > 0)
    );

    // 加载后端持久化配置
    let favoritesConfig = {
        artist: {
            groups: [{ id: "default", name: t("My Favorites"), isSystem: true }],
            items: []
        }
    };
    try {
        const response = await fetch("/anima-tools/favorites");
        if (response.ok) {
            favoritesConfig = await response.json();
        }
    } catch (e) {
        console.error("Failed to load favorites", e);
    }
    
    let groups = favoritesConfig.artist.groups || [{ id: "default", name: t("My Favorites"), isSystem: true }];
    let favoriteItems = favoritesConfig.artist.items || [];
    let favoriteMap = new Map();
    favoriteItems.forEach(fi => {
        if (!fi.isCustom) {
            favoriteMap.set(fi.name, fi);
        }
    });
    let favoriteSet = new Set(favoriteItems.filter(fi => !fi.isCustom).map(fi => fi.name));

    // 匹配已经勾选的自定义项
    favoriteItems.forEach(fi => {
        const customKeys = String(fi.customContent || "")
            .split(",")
            .map(token => cleanArtistToken(token).toLowerCase())
            .filter(Boolean);
        const isBareNumericCustom = customKeys.length === 1 && /^\d+$/.test(customKeys[0]);
        if (fi.isCustom && fi.customContent && customKeys.length > 0 && customKeys.every(key => currentTokenSet.has(key)) && !isBareNumericCustom) {
            selectedArtists.add(fi.name);
        }
    });

    // CDN 镜像源配置 (保存在本地，下次自动读取)
    const CDN_STORAGE_KEY = "anima-selector-active-cdn";
    let activeCdn = localStorage.getItem(CDN_STORAGE_KEY) || "jsdelivr";

    // 记忆排序、页数和滚动位置配置 (本地持久化读取)
    const SORT_STORAGE_KEY = "anima-selector-active-sort";
    const PAGE_STORAGE_KEY = "anima-selector-active-page";
    const SCROLL_STORAGE_KEY = "anima-selector-active-scroll";

    async function saveFavorites() {
        const nextItems = [];
        // 保持自定义项
        favoriteItems.forEach(fi => {
            if (fi.isCustom) {
                nextItems.push(fi);
            }
        });
        // 保持系统项
        favoriteMap.forEach((val, key) => {
            if (favoriteSet.has(key)) {
                nextItems.push(val);
            }
        });
        
        favoriteItems = nextItems;
        favoritesConfig.artist.groups = groups;
        favoritesConfig.artist.items = favoriteItems;
        
        try {
            const response = await fetch("/anima-tools/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(favoritesConfig)
            });
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return true;
        } catch (e) {
            console.error("Failed to save favorites", e);
            alert(t("Failed to save favorites"));
            return false;
        }
    }

    function openMemoEditModal(item, callback) {
        const dialog = document.createElement("div");
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(10px);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = document.createElement("div");
        content.style.cssText = `
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: animaFadeIn 0.2s ease-out;
        `;
        
        const title = document.createElement("div");
        title.innerText = t("Edit Nickname / Note");
        title.style.cssText = "font-size: 16px; font-weight: 700; color: #ffffff;";
        
        const input = document.createElement("input");
        input.type = "text";
        const favInfo = item.isCustom ? item : favoriteMap.get(item.name);
        input.value = favInfo ? favInfo.nickname || "" : "";
        input.placeholder = t("Enter a nickname or descriptive note...");
        input.style.cssText = `
            background: #2c2c2e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;
        input.onfocus = () => input.style.borderColor = "#0b8ce9";
        input.onblur = () => input.style.borderColor = "rgba(255,255,255,0.15)";
        
        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;";
        
        const cancel = document.createElement("button");
        cancel.innerText = t("Cancel");
        cancel.style.cssText = "background: transparent; border: none; color: #9ca3af; padding: 8px 16px; cursor: pointer; font-size: 14px;";
        cancel.onclick = () => dialog.remove();
        
        const confirm = document.createElement("button");
        confirm.innerText = t("Save");
        confirm.style.cssText = "background: #0b8ce9; border: none; color: #ffffff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;";
        confirm.onclick = () => {
            callback(input.value.trim());
            dialog.remove();
        };
        
        input.onkeydown = (e) => {
            if (e.key === "Enter") confirm.click();
            else if (e.key === "Escape") cancel.click();
        };
        
        btnRow.appendChild(cancel);
        btnRow.appendChild(confirm);
        content.appendChild(title);
        content.appendChild(input);
        content.appendChild(btnRow);
        dialog.appendChild(content);
        
        document.body.appendChild(dialog);
        input.focus();
    }

    function openGroupSelectPopover(x, y, item, onUpdate) {
        const existing = document.getElementById("anima-group-popover");
        if (existing) existing.remove();
        
        const popover = document.createElement("div");
        popover.id = "anima-group-popover";
        popover.style.cssText = `
            position: fixed !important;
            top: ${y}px !important;
            left: ${x}px !important;
            background: #1c1c1e !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            border-radius: 12px !important;
            padding: 12px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            z-index: 1000000 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            min-width: 160px !important;
            max-height: 250px !important;
            overflow-y: auto !important;
            transform: translate(-50%, 10px) !important;
            transition: none !important;
            animation: animaPopoverFadeIn 0.15s ease-out forwards !important;
        `;
        
        const favInfo = favoriteMap.get(item.name);
        const activeGroupIds = favInfo ? favInfo.groupIds || [] : [];
        
        groups.forEach(g => {
            const label = document.createElement("label");
            label.style.cssText = "display: flex; align-items: center; gap: 8px; color: #e2e8f0; font-size: 13px; cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: background 0.2s;";
            label.onmouseover = () => label.style.background = "rgba(255,255,255,0.06)";
            label.onmouseout = () => label.style.background = "transparent";
            
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = activeGroupIds.includes(g.id);
            checkbox.style.cssText = "cursor: pointer;";
            
            checkbox.onchange = () => {
                let fav = favoriteMap.get(item.name);
                if (!fav) {
                    fav = { name: item.name, nickname: "", groupIds: [], isCustom: false };
                    favoriteMap.set(item.name, fav);
                }
                
                if (checkbox.checked) {
                    if (!fav.groupIds.includes(g.id)) {
                        fav.groupIds.push(g.id);
                    }
                } else {
                    fav.groupIds = fav.groupIds.filter(id => id !== g.id);
                }
                
                if (fav.groupIds.length === 0) {
                    favoriteSet.delete(item.name);
                } else {
                    favoriteSet.add(item.name);
                }
                
                onUpdate();
            };
            
            label.appendChild(checkbox);
            
            const nameSpan = document.createElement("span");
            nameSpan.innerText = g.isSystem ? t(g.name) : g.name;
            label.appendChild(nameSpan);
            
            popover.appendChild(label);
        });
        
        const closePopoverHandler = (e) => {
            if (!popover.contains(e.target)) {
                popover.remove();
                document.removeEventListener("mousedown", closePopoverHandler);
            }
        };
        
        setTimeout(() => {
            document.addEventListener("mousedown", closePopoverHandler);
        }, 50);
        
        document.body.appendChild(popover);
    }

    function openGroupCreateModal(callback) {
        openTextInputModal(t("Create New Group"), t("Enter group name..."), "", callback);
    }
    
    function openGroupRenameModal(currentName, callback) {
        openTextInputModal(t("Rename Group"), t("Enter new group name..."), currentName, callback);
    }
    
    function openTextInputModal(titleText, placeholderText, defaultValue, callback) {
        const dialog = document.createElement("div");
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(10px);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = document.createElement("div");
        content.style.cssText = `
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: animaFadeIn 0.2s ease-out;
        `;
        
        const title = document.createElement("div");
        title.innerText = titleText;
        title.style.cssText = "font-size: 16px; font-weight: 700; color: #ffffff;";
        
        const input = document.createElement("input");
        input.type = "text";
        input.value = defaultValue;
        input.placeholder = placeholderText;
        input.style.cssText = `
            background: #2c2c2e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
        `;
        
        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;";
        
        const cancel = document.createElement("button");
        cancel.innerText = t("Cancel");
        cancel.style.cssText = "background: transparent; border: none; color: #9ca3af; padding: 8px 16px; cursor: pointer; font-size: 14px;";
        cancel.onclick = () => dialog.remove();
        
        const confirm = document.createElement("button");
        confirm.innerText = t("OK");
        confirm.style.cssText = "background: #0b8ce9; border: none; color: #ffffff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;";
        confirm.onclick = async () => {
            const val = input.value.trim();
            if (val) {
                const prevText = confirm.innerText;
                confirm.disabled = true;
                cancel.disabled = true;
                confirm.innerText = t("Saving...");
                const shouldClose = await callback(val);
                if (shouldClose !== false) {
                    dialog.remove();
                } else {
                    confirm.disabled = false;
                    cancel.disabled = false;
                    confirm.innerText = prevText;
                }
            }
        };
        
        input.onkeydown = (e) => {
            if (e.key === "Enter") confirm.click();
            else if (e.key === "Escape") cancel.click();
        };
        
        btnRow.appendChild(cancel);
        btnRow.appendChild(confirm);
        content.appendChild(title);
        content.appendChild(input);
        content.appendChild(btnRow);
        dialog.appendChild(content);
        
        document.body.appendChild(dialog);
        input.focus();
    }

    function openCustomItemCreateModal(callback) {
        const dialog = document.createElement("div");
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(10px);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = document.createElement("div");
        content.style.cssText = `
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 450px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: animaFadeIn 0.2s ease-out;
        `;
        
        const title = document.createElement("div");
        title.innerText = t("Create Custom Item");
        title.style.cssText = "font-size: 16px; font-weight: 700; color: #ffffff;";
        
        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.placeholder = t("Item Title (e.g. My Style A)...");
        titleInput.style.cssText = `
            background: #2c2c2e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
        `;
        
        const contentInput = document.createElement("textarea");
        contentInput.placeholder = t("Enter prompt tags (e.g. masterpiece, highly detailed)...");
        contentInput.rows = 4;
        contentInput.style.cssText = `
            background: #2c2c2e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            resize: vertical;
            font-family: monospace;
        `;
        
        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;";
        
        const cancel = document.createElement("button");
        cancel.innerText = t("Cancel");
        cancel.style.cssText = "background: transparent; border: none; color: #9ca3af; padding: 8px 16px; cursor: pointer; font-size: 14px;";
        cancel.onclick = () => dialog.remove();
        
        const confirm = document.createElement("button");
        confirm.innerText = t("Create");
        confirm.style.cssText = "background: #0b8ce9; border: none; color: #ffffff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;";
        confirm.onclick = async () => {
            const titleVal = titleInput.value.trim();
            const contentVal = contentInput.value.trim();
            if (titleVal && contentVal) {
                const prevText = confirm.innerText;
                confirm.disabled = true;
                cancel.disabled = true;
                confirm.innerText = t("Saving...");
                const shouldClose = await callback(titleVal, contentVal);
                if (shouldClose !== false) {
                    dialog.remove();
                } else {
                    confirm.disabled = false;
                    cancel.disabled = false;
                    confirm.innerText = prevText;
                }
            } else {
                alert(t("Title and Content cannot be empty!"));
            }
        };
        
        btnRow.appendChild(cancel);
        btnRow.appendChild(confirm);
        content.appendChild(title);
        content.appendChild(titleInput);
        content.appendChild(contentInput);
        content.appendChild(btnRow);
        dialog.appendChild(content);
        
        document.body.appendChild(dialog);
        titleInput.focus();
    }

    const SIDEBAR_STORAGE_KEY = "anima-artist-active-sidebar-category";
    const SIDEBAR_SCROLL_STORAGE_KEY = "anima-artist-sidebar-scroll";

    let activeSort = localStorage.getItem(SORT_STORAGE_KEY) || "works-desc";
    let activeCategory = localStorage.getItem(SIDEBAR_STORAGE_KEY) || "all";
    
    // 如果之前 activeCategory 是 favorites，转换为 default 分组
    if (activeCategory === "favorites") {
        activeCategory = "default";
    }
    
    let lastScrollTop = parseInt(localStorage.getItem(SCROLL_STORAGE_KEY)) || 0;
    let lastSidebarScrollTop = parseInt(localStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY)) || 0;
    let isFirstRender = true;

    function getImgUrl(partition, id) {
        if (activeCdn === "jsdelivr") {
            return `https://fastly.jsdelivr.net/gh/ThetaCursed/Anima-Assets@main/images/${partition}/${id}.webp`;
        } else if (activeCdn === "github") {
            return `https://raw.githubusercontent.com/ThetaCursed/Anima-Assets/main/images/${partition}/${id}.webp`;
        } else {
            return `https://cdn.statically.io/gh/ThetaCursed/Anima-Assets/main/images/${partition}/${id}.webp`;
        }
    }

    // 2. 创建 Modal DOM
    const modalOverlay = document.createElement("div");
    modalOverlay.id = "anima-selector-overlay";
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 10, 15, 0.75);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;

    const modalContainer = document.createElement("div");
    modalContainer.id = "anima-selector-container";
    modalContainer.style.cssText = `
        width: 92%;
        max-width: 1320px;
        height: 90%;
        background: #171718 !important;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: animaFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

    // 点击弹窗遮罩层（弹窗外侧）执行“确认应用并关闭”
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            applySelectionAndClose();
        }
    };

    // 注入动画样式及 ComfyUI 原生经典蓝 #0b8ce9 强调色样式
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes animaFadeIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes animaPopoverFadeIn {
            from { opacity: 0; transform: translate(-50%, 0) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, 10px) scale(1); }
        }
        @keyframes animaShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .anima-shimmer {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: linear-gradient(90deg, rgba(20, 20, 30, 0.8) 25%, rgba(11, 140, 233, 0.12) 50%, rgba(20, 20, 30, 0.8) 75%) !important;
            background-size: 200% 100% !important;
            animation: animaShimmer 1.5s infinite linear !important;
            z-index: 2 !important;
            border-radius: 0 !important;
            pointer-events: none !important;
        }
        @keyframes animaSpin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .anima-spinner {
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            width: 26px !important;
            height: 26px !important;
            border: 2.5px solid rgba(11, 140, 233, 0.15) !important;
            border-top: 2.5px solid #0b8ce9 !important;
            border-radius: 50% !important;
            animation: animaSpin 0.85s infinite linear !important;
            z-index: 3 !important;
        }
        /* Custom Scrollbar */
        .anima-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .anima-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .anima-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        .anima-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
        }
        /* Buttons */
        .anima-btn {
            padding: 9px 18px;
            border-radius: 14px;
            font-size: 13.5px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.05);
            color: #e5e7eb;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            user-select: none;
        }
        .anima-btn:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.12);
            color: white;
            border-color: rgba(255, 255, 255, 0.15);
        }
        .anima-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
        .anima-btn-primary {
            background: linear-gradient(135deg, #0b8ce9, #0572bf);
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(11, 140, 233, 0.3);
            border-color: rgba(11, 140, 233, 0.25);
        }
        .anima-btn-primary:hover:not(:disabled) {
            background: linear-gradient(135deg, #0284c7, #025691);
            box-shadow: 0 6px 16px rgba(11, 140, 233, 0.45);
        }
        .anima-btn-danger {
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #f87171;
        }
        .anima-btn-danger:hover:not(:disabled) {
            background: rgba(239, 68, 68, 0.18);
            border-color: rgba(239, 68, 68, 0.35);
            color: white;
        }
        .anima-btn-active {
            background: rgba(11, 140, 233, 0.2) !important;
            border-color: rgba(11, 140, 233, 0.4) !important;
            color: #7dd3fc !important;
        }
        /* Pagination Bar */
        .anima-pagination {
            padding: 14px 24px;
            background: linear-gradient(180deg, rgba(18,18,24,0.2), rgba(18,18,24,0.62));
            border-top: 1px solid rgba(255,255,255,0.06);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
            box-shadow: 0 -12px 32px rgba(0,0,0,0.18);
        }
        .anima-pagination-stats {
            min-height: 36px;
            padding: 0 14px;
            border-radius: 999px;
            background: rgba(255,255,255,0.045);
            border: 1px solid rgba(255,255,255,0.07);
            color: #d4d4d8;
            font-size: 12.5px;
            font-weight: 750;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            max-width: min(460px, 100%);
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .anima-pagination-stats::before {
            content: "";
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #0b8ce9;
            box-shadow: 0 0 14px rgba(11,140,233,0.72);
            flex: 0 0 auto;
        }
        .anima-pagination-controls {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
            margin-left: auto;
        }
        .anima-page-number {
            min-height: 36px;
            padding: 0;
            border-radius: 0;
            background: transparent;
            border: none;
            color: #d1d5db;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            box-shadow: none;
        }
        .anima-page-btn {
            min-height: 36px;
            padding: 0 13px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 999px;
            color: #d4d4d8;
            font-size: 12.5px;
            font-weight: 750;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }
        .anima-page-btn:hover:not(:disabled) {
            background: rgba(11,140,233,0.16);
            color: white;
            border-color: rgba(11,140,233,0.38);
            transform: translateY(-1px);
        }
        .anima-page-btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }
        .anima-page-input {
            width: 48px;
            padding: 6px 4px;
            background: transparent;
            border: none;
            border-bottom: 1px solid rgba(255,255,255,0.16);
            border-radius: 0;
            color: white;
            font-size: 13px;
            font-weight: 800;
            text-align: center;
            outline: none;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .anima-page-input:focus {
            background: transparent;
            border-bottom-color: rgba(11,140,233,0.72);
            box-shadow: none;
        }

        /* 侧边栏按钮高级样式 */
        .sidebar-item {
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 500;
            color: #a1a1aa;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 1px solid transparent;
            margin-bottom: 4px;
            user-select: none;
        }
        .sidebar-item:hover {
            background: rgba(255, 255, 255, 0.04);
            color: #e4e4e7;
        }
        .sidebar-item.active {
            background: linear-gradient(135deg, rgba(11, 140, 233, 0.15), rgba(2, 86, 145, 0.15)) !important;
            border-color: rgba(11, 140, 233, 0.3) !important;
            color: #7dd3fc !important;
            font-weight: 700 !important;
        }
        .anima-artist-card-clip {
            position: absolute;
            inset: 2.5px;
            z-index: 0;
            overflow: hidden;
            border-radius: 17px;
            clip-path: inset(0 round 17px);
            background: #0a0a10;
        }
    `;
    document.head.appendChild(styleSheet);

    // 3. 构建 Header
    const header = document.createElement("div");
    header.style.cssText = `
        padding: 22px 28px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(18, 18, 24, 0.6);
    `;
    
    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;
    const title = document.createElement("h2");
    title.innerText = t("Anima Artist Style Selector");
    title.style.cssText = "margin: 0; font-size: 22px; font-weight: 800; background: linear-gradient(135deg, #7dd3fc, #0b8ce9, #0284c7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px;";
    
    const subtitle = document.createElement("span");
    subtitle.innerText = t("Browse and select your favorite artist styles, with 3:4 clear preview cards and precise pagination.");
    subtitle.style.cssText = "font-size: 12.5px; color: #9ca3af; font-weight: 500;";
    titleContainer.appendChild(title);
    titleContainer.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `;
    closeBtn.style.cssText = "background: none; border: none; color: #9ca3af; cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 50%; background: rgba(255,255,255,0.03);";
    closeBtn.onclick = () => closeModal();
    closeBtn.onmouseover = () => {
        closeBtn.style.color = "#ffffff";
        closeBtn.style.background = "rgba(239, 68, 68, 0.2)";
        closeBtn.style.transform = "rotate(90deg)";
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.color = "#9ca3af";
        closeBtn.style.background = "rgba(255,255,255,0.03)";
        closeBtn.style.transform = "rotate(0deg)";
    };

    const headerActions = document.createElement("div");
    headerActions.style.cssText = "display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex: 0 0 auto;";
    headerActions.appendChild(createPromoLinks({ accentColor: "#0b8ce9" }));
    headerActions.appendChild(closeBtn);

    header.appendChild(titleContainer);
    header.appendChild(headerActions);
    modalContainer.appendChild(header);

    // 4. 构建 Toolbar / 控制区
    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
        padding: 16px 28px;
        background: rgba(25, 25, 35, 0.15);
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
    `;

    // 左侧：搜索和筛选控制
    const filterControls = document.createElement("div");
    filterControls.style.cssText = "display: flex; gap: 14px; align-items: center; flex: 1; min-width: 300px;";

    const searchInputWrapper = document.createElement("div");
    searchInputWrapper.style.cssText = "position: relative; flex: 1; max-width: 300px;";
    
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = t("Search artist name...");
    searchInput.style.cssText = `
        width: 100%;
        padding: 11px 18px;
        padding-right: 42px;
        background: rgba(10, 10, 15, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        outline: none;
        transition: all 0.25s ease;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
    `;
    searchInput.onfocus = () => {
        searchInput.style.borderColor = "#0b8ce9";
        searchInput.style.boxShadow = "0 0 14px rgba(11, 140, 233, 0.25), inset 0 2px 4px rgba(0,0,0,0.2)";
    };
    searchInput.onblur = () => {
        searchInput.style.borderColor = "rgba(255, 255, 255, 0.08)";
        searchInput.style.boxShadow = "none";
    };

    const clearSearchBtn = document.createElement("span");
    clearSearchBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `;
    clearSearchBtn.style.cssText = `
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: #71717a;
        cursor: pointer;
        display: none;
        line-height: 1;
        transition: color 0.15s ease;
    `;
    clearSearchBtn.onmouseover = () => clearSearchBtn.style.color = "#ffffff";
    clearSearchBtn.onmouseout = () => clearSearchBtn.style.color = "#71717a";
    clearSearchBtn.onclick = () => {
        searchInput.value = "";
        clearSearchBtn.style.display = "none";
        currentPage = 1;
        localStorage.setItem(PAGE_STORAGE_KEY, 1);
        lastScrollTop = 0;
        localStorage.setItem(SCROLL_STORAGE_KEY, 0);
        triggerFilter();
    };

    searchInput.oninput = () => {
        clearSearchBtn.style.display = searchInput.value ? "block" : "none";
        currentPage = 1; 
        localStorage.setItem(PAGE_STORAGE_KEY, 1);
        lastScrollTop = 0;
        localStorage.setItem(SCROLL_STORAGE_KEY, 0);
        triggerFilter();
    };

    searchInputWrapper.appendChild(searchInput);
    searchInputWrapper.appendChild(clearSearchBtn);
    filterControls.appendChild(searchInputWrapper);

    // 排序下拉菜单
    const sortSelect = document.createElement("select");
    sortSelect.style.cssText = `
        padding: 11px 18px;
        background: rgba(10, 10, 15, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        color: #d1d5db;
        font-size: 14px;
        font-weight: 600;
        outline: none;
        cursor: pointer;
        transition: all 0.25s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    `;
    sortSelect.innerHTML = `
        <option value="works-desc">${t("Works Count ⬇")}</option>
        <option value="works-asc">${t("Works Count ⬆")}</option>
        <option value="unique-desc">${t("Uniqueness Score ⬇")}</option>
        <option value="unique-asc">${t("Uniqueness Score ⬆")}</option>
        <option value="name-asc">${t("Name A-Z")}</option>
        <option value="name-desc">${t("Name Z-A")}</option>
        <option value="random">${t("Random")}</option>
    `;
    sortSelect.value = activeSort; 
    sortSelect.onchange = () => {
        currentPage = 1; 
        localStorage.setItem(PAGE_STORAGE_KEY, 1);
        lastScrollTop = 0;
        localStorage.setItem(SCROLL_STORAGE_KEY, 0);
        localStorage.setItem(SORT_STORAGE_KEY, sortSelect.value); 
        triggerFilter();
    };
    filterControls.appendChild(sortSelect);

    // 镜像源切换下拉菜单
    const cdnSelect = document.createElement("select");
    cdnSelect.style.cssText = `
        padding: 11px 18px;
        background: rgba(10, 10, 15, 0.7);
        border: 1px solid rgba(11, 140, 233, 0.2);
        border-radius: 14px;
        color: #7dd3fc;
        font-size: 14px;
        font-weight: 600;
        outline: none;
        cursor: pointer;
        transition: all 0.25s ease;
    `;
    cdnSelect.innerHTML = `
        <option value="jsdelivr" ${activeCdn === "jsdelivr" ? "selected" : ""}>${t("CDN: JsDelivr (Recommended)")}</option>
        <option value="github" ${activeCdn === "github" ? "selected" : ""}>${t("CDN: GitHub Raw (Proxy)")}</option>
        <option value="statically" ${activeCdn === "statically" ? "selected" : ""}>${t("CDN: Statically")}</option>
    `;
    cdnSelect.onchange = () => {
        activeCdn = cdnSelect.value;
        localStorage.setItem(CDN_STORAGE_KEY, activeCdn);
        renderCurrentPage(); 
    };
    filterControls.appendChild(cdnSelect);



    // 右侧：功能按钮
    const actionControls = document.createElement("div");
    actionControls.style.cssText = "display: flex; gap: 12px; align-items: center;";

    // 新加“复制已选”按钮
    const copySelectedBtn = document.createElement("button");
    copySelectedBtn.className = "anima-btn";
    copySelectedBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        ${t("Copy Selected")}
    `;
    copySelectedBtn.onclick = () => {
        if (selectedArtists.size === 0) {
            alert(t("Please select at least one artist first."));
            return;
        }
        const textToCopy = Array.from(selectedArtists).map(name => `@${name}`).join(", ") + ", ";
        
        const performCopy = () => {
            showTemporaryToast(t("Copied Successfully"));
        };
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(performCopy).catch(() => {
                fallbackCopy(textToCopy, performCopy);
            });
        } else {
            fallbackCopy(textToCopy, performCopy);
        }
    };
    actionControls.appendChild(copySelectedBtn);

    const showSelectedOnlyBtn = document.createElement("button");
    showSelectedOnlyBtn.className = "anima-btn";
    showSelectedOnlyBtn.innerHTML = t("Show Selected");
    let showSelectedOnly = false;
    showSelectedOnlyBtn.onclick = () => {
        showSelectedOnly = !showSelectedOnly;
        if (showSelectedOnly) {
            showSelectedOnlyBtn.classList.add("anima-btn-active");
            showSelectedOnlyBtn.style.cssText += `
                background: rgba(11, 140, 233, 0.2) !important;
                border-color: rgba(11, 140, 233, 0.4) !important;
                color: #7dd3fc !important;
            `;
        } else {
            showSelectedOnlyBtn.classList.remove("anima-btn-active");
            showSelectedOnlyBtn.style.cssText = "";
        }
        currentPage = 1;
        triggerFilter();
    };
    actionControls.appendChild(showSelectedOnlyBtn);

    const clearAllBtn = document.createElement("button");
    clearAllBtn.className = "anima-btn anima-btn-danger";
    clearAllBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        ${t("Clear Selected")}
    `;
    clearAllBtn.onclick = () => {
        if (selectedArtists.size === 0) return;
        selectedArtists.clear();
        updateCountLabel();
        renderCurrentPage();
    };
    actionControls.appendChild(clearAllBtn);

    toolbar.appendChild(filterControls);
    toolbar.appendChild(actionControls);
    modalContainer.appendChild(toolbar);

    // 5. 构建主展示区：水平分栏 (左侧侧边栏 + 右侧卡片网格与分页)
    const mainSection = document.createElement("div");
    mainSection.style.cssText = "display: flex; flex: 1; overflow: hidden; background: rgba(10, 10, 15, 0.1);";

    // 5A. 左侧侧边栏 - 分类与收藏
    const sidebar = document.createElement("div");
    sidebar.className = "anima-scrollbar";
    sidebar.style.cssText = `
        width: 250px;
        background: rgba(18, 18, 24, 0.4);
        border-right: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        scrollbar-gutter: stable;
        padding: 20px 12px 20px 16px;
        box-sizing: border-box;
    `;
    sidebar.onscroll = () => {
        localStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, sidebar.scrollTop);
    };

    // 侧边栏主标题
    const sidebarTitle = document.createElement("div");
    sidebarTitle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#0b8ce9;">
            <rect x="3" y="3" width="7" height="9"></rect>
            <rect x="14" y="3" width="7" height="5"></rect>
            <rect x="14" y="12" width="7" height="9"></rect>
            <rect x="3" y="16" width="7" height="5"></rect>
        </svg>
        <span>${t("Browse Categories")}</span>
    `;
    sidebarTitle.style.cssText = "font-size: 12px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-left: 8px;";
    sidebar.appendChild(sidebarTitle);

    const sidebarList = document.createElement("div");
    sidebarList.style.cssText = "display: flex; flex-direction: column;";
    sidebar.appendChild(sidebarList);

    mainSection.appendChild(sidebar);

    // 5B. 右侧展示区 (网格列表 + 分页控制)
    const gridArea = document.createElement("div");
    gridArea.style.cssText = "flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;";

    // 画师卡片网格列表
    const listContainer = document.createElement("div");
    listContainer.className = "anima-scrollbar";
    listContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 24px 28px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 20px;
        align-content: start;
        background: rgba(15, 15, 20, 0.2);
    `;
    listContainer.onscroll = () => {
        localStorage.setItem(SCROLL_STORAGE_KEY, listContainer.scrollTop);
    };
    gridArea.appendChild(listContainer);

    // 创建图片懒加载观察器（绑定到 list 滚动容器）
    const artistImageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                if (el.dataset.lazySrc) {
                    el.src = el.dataset.lazySrc;
                    delete el.dataset.lazySrc;
                }
                artistImageObserver.unobserve(el);
            }
        });
    }, { root: listContainer, rootMargin: "300px" });

    // 6. 构建分页控制栏 (Pagination Bar - 嵌入在网格区底部)
    const paginationBar = document.createElement("div");
    paginationBar.className = "anima-pagination";
    
    const pageStats = document.createElement("div");
    pageStats.className = "anima-pagination-stats";
    pageStats.innerText = t("Total {total} artists | Showing {start}-{end}", { total: 0, start: 0, end: 0 });

    const pageControls = document.createElement("div");
    pageControls.className = "anima-pagination-controls";

    const firstPageBtn = document.createElement("button");
    firstPageBtn.className = "anima-page-btn";
    firstPageBtn.innerText = t("First");
    firstPageBtn.onclick = () => goToPage(1);

    const prevPageBtn = document.createElement("button");
    prevPageBtn.className = "anima-page-btn";
    prevPageBtn.innerText = t("Prev");
    prevPageBtn.onclick = () => goToPage(currentPage - 1);

    const pageNumContainer = document.createElement("div");
    pageNumContainer.className = "anima-page-number";
    
    const pageInput = document.createElement("input");
    pageInput.className = "anima-page-input";
    pageInput.type = "text";
    pageInput.value = "1";
    pageInput.onkeydown = (e) => {
        if (e.key === "Enter") {
            const val = parseInt(pageInput.value);
            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                goToPage(val);
            } else {
                pageInput.value = currentPage;
            }
        }
    };

    const totalPagesLabel = document.createElement("span");
    totalPagesLabel.innerText = `/ 1 ${t("Pages")}`;
    
    pageNumContainer.appendChild(pageInput);
    pageNumContainer.appendChild(totalPagesLabel);

    const nextPageBtn = document.createElement("button");
    nextPageBtn.className = "anima-page-btn";
    nextPageBtn.innerText = t("Next");
    nextPageBtn.onclick = () => goToPage(currentPage + 1);

    const lastPageBtn = document.createElement("button");
    lastPageBtn.className = "anima-page-btn";
    lastPageBtn.innerText = t("Last");
    lastPageBtn.onclick = () => goToPage(totalPages);

    pageControls.appendChild(firstPageBtn);
    pageControls.appendChild(prevPageBtn);
    pageControls.appendChild(pageNumContainer);
    pageControls.appendChild(nextPageBtn);
    pageControls.appendChild(lastPageBtn);

    paginationBar.appendChild(pageStats);
    paginationBar.appendChild(pageControls);
    gridArea.appendChild(paginationBar);

    mainSection.appendChild(gridArea);
    modalContainer.appendChild(mainSection);

    // 7. 构建 Footer / 底部操作栏
    const footer = document.createElement("div");
    footer.style.cssText = `
        padding: 20px 28px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(18, 18, 24, 0.6);
    `;

    const countLabel = document.createElement("div");
    countLabel.style.cssText = "font-size: 14.5px; color: #7dd3fc; font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; transition: opacity 0.2s ease;";
    countLabel.onmouseenter = () => {
        countLabel.style.opacity = "0.75";
    };
    countLabel.onmouseleave = () => {
        countLabel.style.opacity = "1";
    };
    countLabel.onclick = () => {
        showSelectedOnlyBtn.click();
    };
    
    function updateCountLabel() {
        countLabel.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#0b8ce9;">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${t("Selected: {count} artist styles", { count: selectedArtists.size })}</span>
        `;
    }
    updateCountLabel();

    const footerButtons = document.createElement("div");
    footerButtons.style.cssText = "display: flex; gap: 12px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "anima-btn";
    cancelBtn.innerText = t("Cancel");
    cancelBtn.onclick = () => closeModal();

    const applyBtn = document.createElement("button");
    applyBtn.className = "anima-btn anima-btn-primary";
    applyBtn.innerText = t("Confirm & Apply");
    applyBtn.onclick = () => {
        applySelectionAndClose();
    };

    // 确认应用并关闭弹窗
    function applySelectionAndClose() {
        let resultTags = [];
        selectedArtists.forEach(selName => {
            const custItem = favoriteItems.find(fi => fi.isCustom && fi.name === selName);
            if (custItem) {
                const subTags = custItem.customContent.split(",");
                subTags.forEach(st => {
                    const stClean = st.strip ? st.strip() : st.trim();
                    if (stClean) {
                        resultTags.push(`_raw_:${stClean}`);
                    }
                });
            } else {
                resultTags.push(`@${selName}`);
            }
        });
        
        let resultString = resultTags.join(", ");
        if (resultString) {
            resultString += ", ";
        }
        tagsWidget.value = resultString;
        
        if (tagsWidget.inputEl) {
            tagsWidget.inputEl.value = resultString;
            tagsWidget.inputEl.dispatchEvent(new Event("input"));
        }
        
        if (tagsWidget.callback) {
            tagsWidget.callback(resultString);
        }
        
        node.triggerSlot?(0):null;
        closeModal();
    }

    footerButtons.appendChild(cancelBtn);
    footerButtons.appendChild(applyBtn);
    footer.appendChild(countLabel);
    footer.appendChild(footerButtons);
    modalContainer.appendChild(footer);

    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);

    // --- 数据筛选、分页与侧边栏渲染的实现 ---
    
    let filteredData = []; 
    let currentPage = parseInt(localStorage.getItem(PAGE_STORAGE_KEY)) || 1;   
    const pageSize = 60;   
    let totalPages = 1;    

    // 渲染侧边栏菜单
    // 渲染侧边栏菜单
    function renderSidebar() {
        sidebarList.innerHTML = "";

        // 1. 全部画师
        const allItem = document.createElement("div");
        allItem.className = `sidebar-item ${activeCategory === "all" ? "active" : ""}`;
        allItem.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:15px;">✦</span>
                <span>${t("All Artists")}</span>
            </div>
            <span style="font-size:11px;opacity:0.6;background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:20px;">${(window.galleryData || []).length}</span>
        `;
        allItem.onclick = () => switchCategory("all");
        sidebarList.appendChild(allItem);

        // 2. 我的收藏标题
        const collectionsHeader = document.createElement("div");
        collectionsHeader.style.cssText = "font-size: 11px; font-weight: 700; color: #6b7280; padding: 16px 10px 8px 10px; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;";
        collectionsHeader.innerHTML = `
            <span>${t("My Collections")}</span>
            <span id="add-group-btn" style="cursor:pointer; font-size:16px; font-weight:bold; color:#0b8ce9; opacity:0.8; border-radius: 4px; background: rgba(11, 140, 233, 0.1); display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; line-height: 1 !important; padding: 0 !important; box-sizing: border-box !important; transition: all 0.2s ease;" title="${t("Create Group")}">+</span>
        `;
        sidebarList.appendChild(collectionsHeader);

        const addGroupBtn = collectionsHeader.querySelector("#add-group-btn");
        if (addGroupBtn) {
            addGroupBtn.onmouseenter = () => {
                addGroupBtn.style.opacity = "1";
                addGroupBtn.style.background = "rgba(11, 140, 233, 0.2)";
                addGroupBtn.style.transform = "scale(1.1)";
            };
            addGroupBtn.onmouseleave = () => {
                addGroupBtn.style.opacity = "0.8";
                addGroupBtn.style.background = "rgba(11, 140, 233, 0.1)";
                addGroupBtn.style.transform = "scale(1)";
            };
            addGroupBtn.onclick = (e) => {
                e.stopPropagation();
                openGroupCreateModal(async (groupName) => {
                    const newId = "group_" + Date.now();
                    groups.push({ id: newId, name: groupName, isSystem: false });
                    if (!(await saveFavorites())) {
                        groups = groups.filter(group => group.id !== newId);
                        return false;
                    }
                    renderSidebar();
                });
            };
        }

        // 3. 循环渲染分组列表
        groups.forEach(g => {
            const count = favoriteItems.filter(fi => fi.groupIds && fi.groupIds.includes(g.id)).length;
            const item = document.createElement("div");
            item.className = `sidebar-item ${activeCategory === g.id ? "active" : ""}`;
            item.style.cssText = "position: relative;";
            
            const isDefault = g.id === "default";
            
            item.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px; max-width: 60%; overflow:hidden;">
                    <span style="font-size:14px;">${isDefault ? '❤️' : '📁'}</span>
                    <span class="group-name-text" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${isDefault ? t(g.name) : g.name}</span>
                </div>
                <div style="display:flex; align-items:center; gap: 8px;">
                    <span style="font-size:11px;opacity:0.8;background:${isDefault ? 'rgba(11,140,233,0.15)' : 'rgba(255,255,255,0.06)'};color:${isDefault ? '#7dd3fc' : '#9ca3af'};padding:2px 6px;border-radius:20px;font-weight:700;">${count}</span>
                    ${!isDefault ? `
                        <div class="group-actions" style="display:flex; gap:6px; align-items:center; overflow:hidden; max-width:0; opacity:0; transform:translateX(10px); transition:all 0.25s cubic-bezier(0.4, 0, 0.2, 1);">
                            <span class="group-edit-btn" style="cursor:pointer; opacity:0.6; color:#e2e8f0; transition:opacity 0.2s; display:flex; align-items:center;" title="Rename">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path>
                                </svg>
                            </span>
                            <span class="group-del-btn" style="cursor:pointer; opacity:0.6; color:#ef4444; transition:opacity 0.2s; display:flex; align-items:center;" title="Delete">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </span>
                        </div>
                    ` : ''}
                </div>
            `;
            
            item.onclick = () => switchCategory(g.id);
            
            if (!isDefault) {
                const actionsContainer = item.querySelector(".group-actions");
                const editBtn = item.querySelector(".group-edit-btn");
                const delBtn = item.querySelector(".group-del-btn");
                
                item.onmouseenter = () => {
                    actionsContainer.style.maxWidth = "50px";
                    actionsContainer.style.opacity = "1";
                    actionsContainer.style.transform = "translateX(0)";
                };
                item.onmouseleave = () => {
                    actionsContainer.style.maxWidth = "0";
                    actionsContainer.style.opacity = "0";
                    actionsContainer.style.transform = "translateX(10px)";
                };
                
                editBtn.onmouseenter = () => editBtn.style.opacity = "1";
                editBtn.onmouseleave = () => editBtn.style.opacity = "0.6";
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    openGroupRenameModal(g.name, async (newName) => {
                        const oldName = g.name;
                        g.name = newName;
                        if (!(await saveFavorites())) {
                            g.name = oldName;
                            return false;
                        }
                        renderSidebar();
                    });
                };
                
                delBtn.onmouseenter = () => delBtn.style.opacity = "1";
                delBtn.onmouseleave = () => delBtn.style.opacity = "0.5";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(t("Are you sure you want to delete this group? Items inside won't be deleted."))) {
                        groups = groups.filter(gr => gr.id !== g.id);
                        favoriteItems.forEach(fi => {
                            if (fi.groupIds) {
                                fi.groupIds = fi.groupIds.filter(id => id !== g.id);
                            }
                        });
                        if (activeCategory === g.id) {
                            activeCategory = "all";
                        }
                        saveFavorites();
                        renderSidebar();
                        triggerFilter();
                    }
                };
            }
            
            sidebarList.appendChild(item);
        });
    }

    // 切换分类侧边栏
    function switchCategory(category) {
        activeCategory = category;
        localStorage.setItem(SIDEBAR_STORAGE_KEY, category);
        
        const isCustomGroup = category !== "all" && category !== "default";
        
        currentPage = 1;
        localStorage.setItem(PAGE_STORAGE_KEY, 1);
        lastScrollTop = 0;
        localStorage.setItem(SCROLL_STORAGE_KEY, 0);

        renderSidebar();
        triggerFilter();
        listContainer.scrollTop = 0;
    }

    // 执行数据筛选与排序
    function triggerFilter() {
        const query = searchInput.value.toLowerCase().trim();
        const sortVal = sortSelect.value;

        // A. 基础分类过滤；“已选择”视图直接使用全量已选，不与当前筛选条件取交集
        let items = [];
        if (showSelectedOnly) {
            const customItems = favoriteItems.filter(fi => fi.isCustom && selectedArtists.has(fi.name));
            const normalItems = (window.galleryData || []).filter(item => selectedArtists.has(item.name));
            items = [...customItems, ...normalItems];
        } else {
            items = window.galleryData || [];
            const isGroup = activeCategory === "default" || activeCategory.startsWith("group_");
            
            if (isGroup) {
                const groupItemNames = new Set(
                    favoriteItems.filter(fi => !fi.isCustom && fi.groupIds && fi.groupIds.includes(activeCategory)).map(fi => fi.name)
                );
                items = items.filter(item => groupItemNames.has(item.name));
                
                const customItems = favoriteItems.filter(fi => fi.isCustom && fi.groupIds && fi.groupIds.includes(activeCategory));
                items = [...customItems, ...items];
            }

            // B. 搜索关键词过滤
            if (query) {
                items = items.filter(item => {
                    const name = item.isCustom ? (item.nickname || item.name) : item.name;
                    return name && name.toLowerCase().includes(query);
                });
            }
        }

        // C. 排序数据 (自定义项目置顶)
        if (sortVal === "works-desc") {
            items.sort((a, b) => {
                if (a.isCustom && b.isCustom) return 0;
                if (a.isCustom) return -1;
                if (b.isCustom) return 1;
                return b.post_count - a.post_count;
            });
        } else if (sortVal === "works-asc") {
            items.sort((a, b) => {
                if (a.isCustom && b.isCustom) return 0;
                if (a.isCustom) return -1;
                if (b.isCustom) return 1;
                return a.post_count - b.post_count;
            });
        } else if (sortVal === "unique-desc") {
            items.sort((a, b) => {
                if (a.isCustom && b.isCustom) return 0;
                if (a.isCustom) return -1;
                if (b.isCustom) return 1;
                return b.uniqueness_score - a.uniqueness_score;
            });
        } else if (sortVal === "unique-asc") {
            items.sort((a, b) => {
                if (a.isCustom && b.isCustom) return 0;
                if (a.isCustom) return -1;
                if (b.isCustom) return 1;
                return a.uniqueness_score - b.uniqueness_score;
            });
        } else if (sortVal === "name-asc") {
            items.sort((a, b) => {
                const nameA = a.isCustom ? (a.nickname || a.name) : a.name;
                const nameB = b.isCustom ? (b.nickname || b.name) : b.name;
                if (a.isCustom && !b.isCustom) return -1;
                if (!a.isCustom && b.isCustom) return 1;
                return nameA.localeCompare(nameB);
            });
        } else if (sortVal === "name-desc") {
            items.sort((a, b) => {
                const nameA = a.isCustom ? (a.nickname || a.name) : a.name;
                const nameB = b.isCustom ? (b.nickname || b.name) : b.name;
                if (a.isCustom && !b.isCustom) return -1;
                if (!a.isCustom && b.isCustom) return 1;
                return nameB.localeCompare(nameA);
            });
        } else if (sortVal === "random") {
            const customItems = items.filter(item => item.isCustom);
            const normalItems = items.filter(item => !item.isCustom);
            for (let i = normalItems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [normalItems[i], normalItems[j]] = [normalItems[j], normalItems[i]];
            }
            items = [...customItems, ...normalItems];
        }

        filteredData = items;
        
        totalPages = Math.ceil(filteredData.length / pageSize);
        if (totalPages === 0) totalPages = 1;
        
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        updatePaginationBar();
        renderCurrentPage();
    }

    // 更新分页栏的交互状态
    function updatePaginationBar() {
        const totalItems = filteredData.length;
        const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
        const endIdx = Math.min(currentPage * pageSize, totalItems);
        
        pageStats.innerText = t("Total {total} artists | Showing {start}-{end}", { total: totalItems, start: startIdx, end: endIdx });
        
        pageInput.value = currentPage;
        totalPagesLabel.innerText = `/ ${totalPages} ${t("Pages")}`;
        
        firstPageBtn.disabled = (currentPage === 1);
        prevPageBtn.disabled = (currentPage === 1);
        nextPageBtn.disabled = (currentPage === totalPages);
        lastPageBtn.disabled = (currentPage === totalPages);
    }

    // 翻页操作
    function goToPage(pageNum) {
        if (pageNum < 1 || pageNum > totalPages) return;
        currentPage = pageNum;
        localStorage.setItem(PAGE_STORAGE_KEY, currentPage); 

        lastScrollTop = 0;
        localStorage.setItem(SCROLL_STORAGE_KEY, 0);

        updatePaginationBar();
        renderCurrentPage();
        listContainer.scrollTop = 0; 
    }

    // 复制通知提示框
    function showTemporaryToast(msg) {
        const toast = document.createElement("div");
        toast.className = "anima-toast-inline";
        toast.innerText = msg;
        toast.style.cssText = `
            position: fixed !important;
            bottom: 30px !important;
            right: 30px !important;
            background: rgba(16, 16, 24, 0.92) !important;
            border: 1px solid rgba(11, 140, 233, 0.45) !important;
            color: #ffffff !important;
            padding: 10px 20px !important;
            border-radius: 12px !important;
            font-size: 13px !important;
            z-index: 100000 !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.6) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
            pointer-events: none !important;
            animation: animaFadeIn 0.2s ease forwards !important;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = "opacity 0.3s ease";
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }

    // 备用文本复制
    function fallbackCopy(text, callback) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; 
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand("copy");
            callback();
        } catch (err) {
            console.error("Fallback copy failed", err);
        }
        textArea.remove();
    }

    // 渲染当前页的画师卡片
    function renderCurrentPage() {
        listContainer.innerHTML = "";
        
        const isCustomGroup = !showSelectedOnly && activeCategory !== "all" && activeCategory !== "default";
        
        if (filteredData.length === 0 && !isCustomGroup) {
            const noResult = document.createElement("div");
            noResult.style.cssText = "grid-column: 1 / -1; padding: 60px; text-align: center; color: #9ca3af; font-size: 16px; font-weight: 500;";
            noResult.innerText = t("No matching artist styles found");
            listContainer.appendChild(noResult);
            return;
        }

        const currentPageData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        const fragment = document.createDocumentFragment();
        
        // 如果是自定义分组，且当前在第一页，在最前面添加“新建自定义项”虚线卡片
        if (isCustomGroup && currentPage === 1) {
            const createCard = document.createElement("div");
            createCard.style.cssText = `
                background: rgba(22, 22, 32, 0.4) !important;
                border: 2px dashed rgba(11, 140, 233, 0.4) !important;
                border-radius: 20px !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                height: 0 !important;
                padding-bottom: 133.33% !important; 
                cursor: pointer !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important; 
                position: relative !important;
                user-select: none !important;
                box-sizing: border-box !important;
            `;
            
            const contentWrap = document.createElement("div");
            contentWrap.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                box-sizing: border-box;
                padding: 16px;
                color: #7dd3fc;
                transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.25s ease !important;
            `;
            
            contentWrap.innerHTML = `
                <div style="font-size: 44px; line-height: 1; font-weight: 300;">+</div>
                <div style="font-size: 13.5px; font-weight: 700; text-align: center;">${t("Create Custom Item")}</div>
            `;
            createCard.appendChild(contentWrap);
            
            createCard.onmouseenter = () => {
                createCard.style.setProperty("background", "rgba(11, 140, 233, 0.05)", "important");
                createCard.style.setProperty("border-color", "rgba(11, 140, 233, 0.8)", "important");
                contentWrap.style.color = "#ffffff";
                contentWrap.style.transform = "scale(1.08)";
            };
            createCard.onmouseleave = () => {
                createCard.style.setProperty("background", "rgba(22, 22, 32, 0.4)", "important");
                createCard.style.setProperty("border-color", "rgba(11, 140, 233, 0.4)", "important");
                contentWrap.style.color = "#7dd3fc";
                contentWrap.style.transform = "scale(1)";
            };
            
            createCard.onclick = (e) => {
                e.stopPropagation();
                openCustomItemCreateModal(async (title, content) => {
                    const newItem = {
                        id: "custom_" + Date.now(),
                        name: title,
                        nickname: title,
                        groupIds: [activeCategory],
                        isCustom: true,
                        customContent: content
                    };
                    favoriteItems.push(newItem);
                    if (!(await saveFavorites())) {
                        favoriteItems = favoriteItems.filter(fi => fi.id !== newItem.id);
                        return false;
                    }
                    triggerFilter();
                    renderSidebar();
                });
            };
            
            fragment.appendChild(createCard);
        }
        
        currentPageData.forEach(item => {
            const isSelected = selectedArtists.has(item.name);
            const isFavorite = item.isCustom ? true : favoriteSet.has(item.name);
            
            const card = document.createElement("div");
            card.dataset.name = item.name;
            
            card.style.cssText = `
                background: rgba(22, 22, 32, 0.7) !important;
                border: ${isSelected ? '2.5px solid #0b8ce9' : '2.5px solid rgba(255, 255, 255, 0.04)'} !important;
                border-radius: 20px !important;
                overflow: hidden !important;
                display: block !important;
                width: 100% !important;
                height: 0 !important;
                padding-bottom: 133.33% !important; 
                cursor: pointer !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important; 
                position: relative !important;
                user-select: none !important;
                box-sizing: border-box !important;
                isolation: isolate !important;
                box-shadow: ${isSelected ? '0 10px 25px rgba(11, 140, 233, 0.35)' : '0 4px 12px rgba(0,0,0,0.15)'} !important;
            `;
            const cardClip = document.createElement("div");
            cardClip.className = "anima-artist-card-clip";
            card.appendChild(cardClip);
            
            // Checkbox overlay (放在左上角)
            const checkbox = document.createElement("div");
            checkbox.style.cssText = `
                position: absolute !important;
                top: 12px !important;
                left: 12px !important;
                width: 22px !important;
                height: 22px !important;
                border-radius: 50% !important;
                background: ${isSelected ? '#0b8ce9' : 'rgba(10, 10, 15, 0.5)'} !important;
                border: 1.5px solid ${isSelected ? '#0b8ce9' : 'rgba(255, 255, 255, 0.35)'} !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 10 !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.4);
            `;
            checkbox.innerHTML = isSelected ? `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            ` : '';
            card.appendChild(checkbox);

            // ❤️ 收藏爱心图标 / 🗑️ 删除自定义项 (放在右上角)
            const favIcon = document.createElement("div");
            favIcon.style.cssText = `
                position: absolute !important;
                top: 10px !important;
                right: 10px !important;
                padding: 6px !important;
                z-index: 10 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.2s ease !important;
                cursor: pointer !important;
                border-radius: 50% !important;
                background: rgba(10, 10, 15, 0.4) !important;
                backdrop-filter: blur(5px) !important;
                -webkit-backdrop-filter: blur(5px) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
            `;
            
            if (item.isCustom) {
                favIcon.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                `;
                favIcon.onmouseover = (e) => {
                    e.stopPropagation();
                    favIcon.style.transform = "scale(1.15)";
                    favIcon.style.background = "rgba(239, 68, 68, 0.2)";
                };
                favIcon.onmouseout = (e) => {
                    e.stopPropagation();
                    favIcon.style.transform = "scale(1)";
                    favIcon.style.background = "rgba(10, 10, 15, 0.4)";
                };
                favIcon.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(t("Are you sure you want to delete this custom item?"))) {
                        favoriteItems = favoriteItems.filter(fi => fi.name !== item.name);
                        selectedArtists.delete(item.name);
                        saveFavorites();
                        triggerFilter();
                        renderSidebar();
                    }
                };
            } else {
                favIcon.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFavorite ? '#0b8ce9' : 'none'}" stroke="${isFavorite ? '#0b8ce9' : '#d1d5db'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s ease;">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                `;
                favIcon.onmouseover = (e) => {
                    e.stopPropagation();
                    favIcon.style.transform = "scale(1.15)";
                    favIcon.style.background = "rgba(10, 10, 15, 0.7)";
                    const svg = favIcon.querySelector('svg');
                    if (!isFavorite) svg.setAttribute('stroke', '#0b8ce9');
                };
                favIcon.onmouseout = (e) => {
                    e.stopPropagation();
                    favIcon.style.transform = "scale(1)";
                    favIcon.style.background = "rgba(10, 10, 15, 0.4)";
                    const svg = favIcon.querySelector('svg');
                    if (!isFavorite) svg.setAttribute('stroke', '#d1d5db');
                };
                favIcon.onclick = (e) => {
                    e.stopPropagation();
                    if (favoriteSet.has(item.name)) {
                        favoriteSet.delete(item.name);
                        const svg = favIcon.querySelector('svg');
                        svg.setAttribute('fill', 'none');
                        svg.setAttribute('stroke', '#d1d5db');
                        memoBtn.style.display = "none";
                        groupBtn.style.display = "none";
                    } else {
                        favoriteSet.add(item.name);
                        const svg = favIcon.querySelector('svg');
                        svg.setAttribute('fill', '#0b8ce9');
                        svg.setAttribute('stroke', '#0b8ce9');
                        favIcon.style.transform = "scale(1.3) rotate(-10deg)";
                        setTimeout(() => favIcon.style.transform = "scale(1)", 200);
                        memoBtn.style.display = "flex";
                        groupBtn.style.display = "flex";
                        
                        let fav = favoriteMap.get(item.name);
                        if (!fav) {
                            fav = { name: item.name, nickname: "", groupIds: ["default"], isCustom: false };
                            favoriteMap.set(item.name, fav);
                        } else if (!fav.groupIds.includes("default")) {
                            fav.groupIds.push("default");
                        }
                    }
                    saveFavorites();
                    renderSidebar(); 
                    if (activeCategory === "favorites" || activeCategory === "default" || activeCategory.startsWith("group_")) {
                        triggerFilter();
                    }
                };
            }
            card.appendChild(favIcon);

            // ✏️ 编辑备注按钮 (放在右上角心形按钮下方)
            const memoBtn = document.createElement("div");
            memoBtn.style.cssText = `
                position: absolute !important;
                top: 46px !important;
                right: 10px !important;
                padding: 6px !important;
                z-index: 10 !important;
                display: ${isFavorite ? 'flex' : 'none'} !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.2s ease !important;
                cursor: pointer !important;
                border-radius: 50% !important;
                background: rgba(10, 10, 15, 0.4) !important;
                backdrop-filter: blur(5px) !important;
                -webkit-backdrop-filter: blur(5px) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
            `;
            memoBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path>
                </svg>
            `;
            memoBtn.onmouseover = (e) => {
                e.stopPropagation();
                memoBtn.style.transform = "scale(1.15)";
                memoBtn.style.background = "rgba(10, 10, 15, 0.7)";
            };
            memoBtn.onmouseout = (e) => {
                e.stopPropagation();
                memoBtn.style.transform = "scale(1)";
                memoBtn.style.background = "rgba(10, 10, 15, 0.4)";
            };
            memoBtn.onclick = (e) => {
                e.stopPropagation();
                openMemoEditModal(item, (newMemo) => {
                    if (item.isCustom) {
                        item.nickname = newMemo;
                    } else {
                        let fav = favoriteMap.get(item.name);
                        if (!fav) {
                            fav = { name: item.name, nickname: newMemo, groupIds: ["default"], isCustom: false };
                            favoriteMap.set(item.name, fav);
                            favoriteSet.add(item.name);
                        } else {
                            fav.nickname = newMemo;
                        }
                    }
                    saveFavorites();
                    renderSidebar();
                    triggerFilter();
                });
            };
            card.appendChild(memoBtn);

            // 📁 管理分组按钮 (放在备注按钮下方)
            const groupBtn = document.createElement("div");
            groupBtn.style.cssText = `
                position: absolute !important;
                top: 82px !important;
                right: 10px !important;
                padding: 6px !important;
                z-index: 10 !important;
                display: ${(isFavorite && !item.isCustom) ? 'flex' : 'none'} !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.2s ease !important;
                cursor: pointer !important;
                border-radius: 50% !important;
                background: rgba(10, 10, 15, 0.4) !important;
                backdrop-filter: blur(5px) !important;
                -webkit-backdrop-filter: blur(5px) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
            `;
            groupBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            `;
            groupBtn.onmouseover = (e) => {
                e.stopPropagation();
                groupBtn.style.transform = "scale(1.15)";
                groupBtn.style.background = "rgba(10, 10, 15, 0.7)";
            };
            groupBtn.onmouseout = (e) => {
                e.stopPropagation();
                groupBtn.style.transform = "scale(1)";
                groupBtn.style.background = "rgba(10, 10, 15, 0.4)";
            };
            groupBtn.onclick = (e) => {
                e.stopPropagation();
                const rect = groupBtn.getBoundingClientRect();
                openGroupSelectPopover(rect.left + rect.width / 2, rect.bottom, item, () => {
                    saveFavorites();
                    renderSidebar();
                    if (activeCategory !== "all") {
                        triggerFilter();
                    }
                });
            };
            card.appendChild(groupBtn);

            // Image Element or Custom Placeholder
            const placeholder = document.createElement("div");
            placeholder.className = "anima-card-placeholder";
            
            let img = null;

            if (item.isCustom) {
                placeholder.style.cssText = `
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: linear-gradient(135deg, #1e293b, #0f172a) !important;
                    z-index: 1 !important;
                    opacity: 1 !important;
                    text-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
                    box-sizing: border-box;
                    padding: 20px;
                `;
                placeholder.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 8px;">📄</div>
                    <div style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 8px; border-radius: 20px; text-transform: uppercase;">Custom</div>
                `;
                cardClip.appendChild(placeholder);
            } else {
                let firstChar = "A";
                if (item.name) {
                    const cleanName = item.name.replace(/[^a-zA-Z]/g, "");
                    firstChar = cleanName.length > 0 ? cleanName[0].toUpperCase() : item.name[0].toUpperCase();
                }
                
                let hash = 0;
                for (let i = 0; i < item.name.length; i++) {
                    hash = item.name.charCodeAt(i) + ((hash << 5) - hash);
                }
                const hue = Math.abs(hash % 360);
                
                placeholder.style.cssText = `
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 56px !important;
                    font-weight: 900 !important;
                    color: rgba(255,255,255,0.7) !important;
                    background: linear-gradient(135deg, hsl(${hue}, 45%, 32%), hsl(${(hue + 45) % 360}, 50%, 18%)) !important;
                    z-index: 1 !important;
                    opacity: 0 !important;
                    transition: opacity 0.25s ease !important;
                    text-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
                `;
                placeholder.innerText = firstChar;
                cardClip.appendChild(placeholder);

                img = document.createElement("img");
                img.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    z-index: 2;
                    opacity: 0;
                    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                `;
                img.loading = "lazy";
                
                const partition = item.p || 1;
                const imgUrl = getImgUrl(partition, item.id);
                
                let loader = null;
                if (isImageLoaded(imgUrl)) {
                    // 缓存命中：直接显示，跳过 spinner
                    img.src = imgUrl;
                    img.style.opacity = "1";
                } else {
                    // 未缓存：懒加载
                    img.dataset.lazySrc = imgUrl;
                    loader = document.createElement("div");
                    loader.className = "anima-shimmer";
                    const spinner = document.createElement("div");
                    spinner.className = "anima-spinner";
                    loader.appendChild(spinner);
                    cardClip.appendChild(loader);
                }
                
                img.onload = () => {
                    img.style.opacity = "1";
                    loader?.remove();
                    markImageLoaded(imgUrl);
                };
                img.onerror = () => {
                    img.style.display = "none";
                    loader?.remove();
                    placeholder.style.opacity = "1"; 
                };
                cardClip.appendChild(img);
                artistImageObserver.observe(img);
            }

            const mask = document.createElement("div");
            mask.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(to top, rgba(14, 14, 18, 0.98) 0%, rgba(14, 14, 18, 0.55) 45%, rgba(0, 0, 0, 0) 100%);
                z-index: 3;
            `;
            cardClip.appendChild(mask);

            // Info Section
            const infoPanel = document.createElement("div");
            infoPanel.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                padding: 16px 14px;
                box-sizing: border-box;
                z-index: 4;
                display: flex;
                flex-direction: column;
                gap: 5px;
            `;
            
            const nameEl = document.createElement("div");
            nameEl.style.cssText = "font-size: 14px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.6);";
            
            const favInfo = item.isCustom ? item : favoriteMap.get(item.name);
            const nickname = favInfo ? favInfo.nickname : "";
            
            if (item.isCustom) {
                nameEl.innerText = item.nickname || item.name;
            } else {
                const displayName = item.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                if (nickname) {
                    nameEl.innerHTML = `${displayName} <span style="font-size:11px;color:#a7f3d0;font-weight:normal;display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;">✏️ ${nickname}</span>`;
                } else {
                    nameEl.innerText = displayName;
                }
            }
            
            const statsContainer = document.createElement("div");
            statsContainer.style.cssText = "display: flex; align-items: center; justify-content: space-between; width: 100%; overflow: hidden; gap: 8px;";
            
            if (item.isCustom) {
                const customPreview = document.createElement("span");
                customPreview.innerText = item.customContent || "";
                customPreview.style.cssText = "font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; max-width: 100%;";
                statsContainer.appendChild(customPreview);
            } else {
                const worksEl = document.createElement("span");
                worksEl.innerText = `${item.post_count} w`;
                worksEl.style.cssText = `
                    font-size: 10px;
                    font-weight: 700;
                    color: #38bdf8;
                    background: rgba(11, 140, 233, 0.15);
                    border: 1px solid rgba(11, 140, 233, 0.25);
                    padding: 2.5px 8px;
                    border-radius: 9999px;
                    white-space: nowrap;
                `;
                
                const uniqueEl = document.createElement("span");
                uniqueEl.innerText = `${t("Uniqueness ")}${item.uniqueness_score.toFixed(1)}`;
                uniqueEl.style.cssText = `
                    font-size: 10.5px;
                    color: #fbbf24;
                    font-weight: 700;
                    white-space: nowrap;
                    background: rgba(251, 191, 36, 0.08);
                    border: 1px solid rgba(251, 191, 36, 0.15);
                    padding: 2px 6px;
                    border-radius: 6px;
                `;
                
                statsContainer.appendChild(worksEl);
                statsContainer.appendChild(uniqueEl);
            }
            
            infoPanel.appendChild(nameEl);
            infoPanel.appendChild(statsContainer);
            cardClip.appendChild(infoPanel);

            // 点击卡片选择
            card.onclick = () => {
                const name = card.dataset.name;
                if (selectedArtists.has(name)) {
                    selectedArtists.delete(name);
                    card.style.borderColor = "rgba(255, 255, 255, 0.04)";
                    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                    checkbox.style.background = "rgba(10, 10, 15, 0.5)";
                    checkbox.style.borderColor = "rgba(255, 255, 255, 0.35)";
                    checkbox.innerHTML = "";
                } else {
                    selectedArtists.add(name);
                    card.style.borderColor = "#0b8ce9";
                    card.style.boxShadow = "0 10px 25px rgba(11, 140, 233, 0.35)";
                    checkbox.style.background = "#0b8ce9";
                    checkbox.style.borderColor = "#0b8ce9";
                    checkbox.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                }
                updateCountLabel();
            };

            card.onmouseenter = () => {
                if (!isSelected) {
                    card.style.borderColor = "rgba(11, 140, 233, 0.4)";
                    card.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(11, 140, 233, 0.15)";
                }
                if (img) {
                    img.style.transform = "scale(1.08)";
                }
            };
            card.onmouseleave = () => {
                if (!isSelected) {
                    card.style.borderColor = "rgba(255, 255, 255, 0.04)";
                    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                } else {
                    card.style.boxShadow = "0 10px 25px rgba(11, 140, 233, 0.35)";
                }
                if (img) {
                    img.style.transform = "none";
                }
            };

            fragment.appendChild(card);
        });

        listContainer.appendChild(fragment);

        // 首次加载复原大图滚动高度
        if (isFirstRender && lastScrollTop > 0) {
            listContainer.scrollTop = lastScrollTop;
            setTimeout(() => {
                listContainer.scrollTop = lastScrollTop;
            }, 30);
            setTimeout(() => {
                listContainer.scrollTop = lastScrollTop;
            }, 100);
            setTimeout(() => {
                listContainer.scrollTop = lastScrollTop;
            }, 250);
        }
    }

    // 关闭弹窗
    function closeModal() {
        artistImageObserver.disconnect();
        modalOverlay.remove();
        styleSheet.remove();
    }

    // 首次初始化渲染侧边栏和数据流
    renderSidebar();
    triggerFilter();

    // 恢复侧边栏滚动高度
    if (lastSidebarScrollTop > 0) {
        sidebar.scrollTop = lastSidebarScrollTop;
        setTimeout(() => {
            sidebar.scrollTop = lastSidebarScrollTop;
        }, 50);
        setTimeout(() => {
            sidebar.scrollTop = lastSidebarScrollTop;
        }, 150);
    }

    // 标记首次渲染结束
    isFirstRender = false;
}
