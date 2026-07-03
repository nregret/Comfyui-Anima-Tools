def _anima_selector_tags_result(tags, text):
    payload = tags if isinstance(tags, dict) else {}
    return {"ui": {"anima_selector_tags": [payload]}, "result": (text,)}

class AnimaArtistTagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "artist_tags": ("STRING", {"multiline": True, "default": ""}),
                "mode": (["append", "override"], {"default": "append"}),
            },
            "optional": {
                "opt_prompt": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"
    def process_tags(self, artist_tags, mode, opt_prompt=""):
        tags_list = [t.strip() for t in artist_tags.split(",") if t.strip()]
        processed_tags = []
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            elif clean_tag.lower().startswith("by "):
                clean_tag = clean_tag[3:].strip()
            if clean_tag:
                processed_tags.append(f"@{clean_tag}")
        joined_artists = ", ".join(processed_tags)

        # 结合外部 prompt
        if opt_prompt and opt_prompt.strip():
            opt_prompt = opt_prompt.strip()
            if mode == "append":
                # 追加模式：选择的画师 tag 在前，外接的 opt_prompt 在后，末尾补上逗号
                if joined_artists:
                    if opt_prompt.endswith(","):
                        final_text = f"{joined_artists}, {opt_prompt}"
                    else:
                        final_text = f"{joined_artists}, {opt_prompt}, "
                else:
                    final_text = opt_prompt
            else:
                # 覆盖模式：直接输出画师 tags，并在末尾带上逗号
                if joined_artists:
                    final_text = f"{joined_artists}, "
                else:
                    final_text = ""
        else:
            if joined_artists:
                final_text = f"{joined_artists}, "
            else:
                final_text = ""

        return _anima_selector_tags_result({"artist_tags": artist_tags}, final_text)

class AnimaArtistTagSelectorPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "artist_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, artist_tags, extra_text, separator=", "):
        # 1. 过滤并处理画师 tags
        tags_list = [t.strip() for t in artist_tags.split(",") if t.strip()]
        processed_tags = []
        
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            elif clean_tag.lower().startswith("by "):
                clean_tag = clean_tag[3:].strip()
            
            if clean_tag:
                processed_tags.append(f"@{clean_tag}")
        
        joined_artists = ", ".join(processed_tags)
        # 🌟 只要有画师，尾部必带逗号与空格，保证输出框及默认状态下的绝对完美隔开
        if joined_artists:
            joined_artists += ", "

        # 2. 将两段自动拼接到一起 (画师在前，自定义提示词在后)
        extra_text_clean = extra_text.strip() if extra_text else ""
        
        if extra_text_clean and joined_artists:
            # 画师在前，提示词在后
            # 🌟 智能合并去重：如果分隔符是逗号或被删空，则直接利用 joined_artists 尾部的逗号连接，避免产生多余的双逗号
            sep = separator if separator is not None else ", "
            if sep.strip() == "," or sep.strip() == "":
                final_text = f"{joined_artists}{extra_text_clean}"
            else:
                # 否则，剥离画师尾部逗号，使用用户填写的自定义非逗号分隔符连接
                final_text = f"{joined_artists.rstrip(', ')}{sep}{extra_text_clean}"
        elif extra_text_clean:
            final_text = extra_text_clean
        else:
            final_text = joined_artists

        return _anima_selector_tags_result({"artist_tags": artist_tags}, final_text)

class AnimaCharacterTagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "character_tags": ("STRING", {"multiline": True, "default": ""}),
                "mode": (["append", "override"], {"default": "append"}),
            },
            "optional": {
                "opt_prompt": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, character_tags, mode, opt_prompt=""):
        tags_list = [t.strip() for t in character_tags.split(",") if t.strip()]
        processed_tags = []
        
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            
            if clean_tag:
                processed_tags.append(clean_tag)
        
        joined_characters = ", ".join(processed_tags)

        if opt_prompt and opt_prompt.strip():
            opt_prompt = opt_prompt.strip()
            if mode == "append":
                # 追加模式：选择的角色 tag 在前，外接的 opt_prompt 在后，末尾补上逗号
                if joined_characters:
                    if opt_prompt.endswith(","):
                        final_text = f"{joined_characters}, {opt_prompt}"
                    else:
                        final_text = f"{joined_characters}, {opt_prompt}, "
                else:
                    final_text = opt_prompt
            else:
                if joined_characters:
                    final_text = f"{joined_characters}, "
                else:
                    final_text = ""
        else:
            if joined_characters:
                final_text = f"{joined_characters}, "
            else:
                final_text = ""

        return _anima_selector_tags_result({"character_tags": character_tags}, final_text)

class AnimaCharacterTagSelectorPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "character_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, character_tags, extra_text, separator=", "):
        tags_list = [t.strip() for t in character_tags.split(",") if t.strip()]
        processed_tags = []
        
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            
            if clean_tag:
                processed_tags.append(clean_tag)
        
        joined_characters = ", ".join(processed_tags)
        if joined_characters:
            joined_characters += ", "

        extra_text_clean = extra_text.strip() if extra_text else ""
        
        if extra_text_clean and joined_characters:
            sep = separator if separator is not None else ", "
            if sep.strip() == "," or sep.strip() == "":
                final_text = f"{joined_characters}{extra_text_clean}"
            else:
                final_text = f"{joined_characters.rstrip(', ')}{sep}{extra_text_clean}"
        elif extra_text_clean:
            final_text = extra_text_clean
        else:
            final_text = joined_characters

        return _anima_selector_tags_result({"character_tags": character_tags}, final_text)

class AnimaClothingTagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clothing_tags": ("STRING", {"multiline": True, "default": ""}),
                "mode": (["append", "override"], {"default": "append"}),
            },
            "optional": {
                "opt_prompt": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, clothing_tags, mode, opt_prompt=""):
        tags_list = [t.strip() for t in clothing_tags.split(",") if t.strip()]
        processed_tags = []

        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            if tag:
                processed_tags.append(tag)

        joined_clothing = ", ".join(processed_tags)

        if opt_prompt and opt_prompt.strip():
            opt_prompt = opt_prompt.strip()
            if mode == "append":
                if joined_clothing:
                    if opt_prompt.endswith(","):
                        final_text = f"{joined_clothing}, {opt_prompt}"
                    else:
                        final_text = f"{joined_clothing}, {opt_prompt}, "
                else:
                    final_text = opt_prompt
            else:
                if joined_clothing:
                    final_text = f"{joined_clothing}, "
                else:
                    final_text = ""
        else:
            if joined_clothing:
                final_text = f"{joined_clothing}, "
            else:
                final_text = ""

        return _anima_selector_tags_result({"clothing_tags": clothing_tags}, final_text)

class AnimaClothingTagSelectorPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clothing_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, clothing_tags, extra_text, separator=", "):
        tags_list = [t.strip() for t in clothing_tags.split(",") if t.strip()]
        processed_tags = []

        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            if tag:
                processed_tags.append(tag)

        joined_clothing = ", ".join(processed_tags)
        if joined_clothing:
            joined_clothing += ", "

        extra_text_clean = extra_text.strip() if extra_text else ""

        if extra_text_clean and joined_clothing:
            sep = separator if separator is not None else ", "
            if sep.strip() == "," or sep.strip() == "":
                final_text = f"{joined_clothing}{extra_text_clean}"
            else:
                final_text = f"{joined_clothing.rstrip(', ')}{sep}{extra_text_clean}"
        elif extra_text_clean:
            final_text = extra_text_clean
        else:
            final_text = joined_clothing

        return _anima_selector_tags_result({"clothing_tags": clothing_tags}, final_text)

class AnimaBackgroundTagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "background_tags": ("STRING", {"multiline": True, "default": ""}),
                "mode": (["append", "override"], {"default": "append"}),
            },
            "optional": {
                "opt_prompt": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, background_tags, mode, opt_prompt=""):
        tags_list = [t.strip() for t in background_tags.split(",") if t.strip()]
        processed_tags = []

        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            if tag:
                processed_tags.append(tag)

        joined_background = ", ".join(processed_tags)

        if opt_prompt and opt_prompt.strip():
            opt_prompt = opt_prompt.strip()
            if mode == "append":
                if joined_background:
                    if opt_prompt.endswith(","):
                        final_text = f"{joined_background}, {opt_prompt}"
                    else:
                        final_text = f"{joined_background}, {opt_prompt}, "
                else:
                    final_text = opt_prompt
            else:
                if joined_background:
                    final_text = f"{joined_background}, "
                else:
                    final_text = ""
        else:
            if joined_background:
                final_text = f"{joined_background}, "
            else:
                final_text = ""

        return _anima_selector_tags_result({"background_tags": background_tags}, final_text)

class AnimaBackgroundTagSelectorPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "background_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, background_tags, extra_text, separator=", "):
        tags_list = [t.strip() for t in background_tags.split(",") if t.strip()]
        processed_tags = []

        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            if tag:
                processed_tags.append(tag)

        joined_background = ", ".join(processed_tags)
        if joined_background:
            joined_background += ", "

        extra_text_clean = extra_text.strip() if extra_text else ""

        if extra_text_clean and joined_background:
            sep = separator if separator is not None else ", "
            if sep.strip() == "," or sep.strip() == "":
                final_text = f"{joined_background}{extra_text_clean}"
            else:
                final_text = f"{joined_background.rstrip(', ')}{sep}{extra_text_clean}"
        elif extra_text_clean:
            final_text = extra_text_clean
        else:
            final_text = joined_background

        return _anima_selector_tags_result({"background_tags": background_tags}, final_text)

class AnimaPoseTagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "pose_tags": ("STRING", {"multiline": True, "default": ""}),
                "mode": (["append", "override"], {"default": "append"}),
            },
            "optional": {
                "opt_prompt": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, pose_tags, mode, opt_prompt=""):
        tags_list = [t.strip() for t in pose_tags.split(",") if t.strip()]
        processed_tags = []

        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            if tag:
                processed_tags.append(tag)

        joined_pose = ", ".join(processed_tags)

        if opt_prompt and opt_prompt.strip():
            opt_prompt = opt_prompt.strip()
            if mode == "append":
                if joined_pose:
                    if opt_prompt.endswith(","):
                        final_text = f"{joined_pose}, {opt_prompt}"
                    else:
                        final_text = f"{joined_pose}, {opt_prompt}, "
                else:
                    final_text = opt_prompt
            else:
                if joined_pose:
                    final_text = f"{joined_pose}, "
                else:
                    final_text = ""
        else:
            if joined_pose:
                final_text = f"{joined_pose}, "
            else:
                final_text = ""

        return _anima_selector_tags_result({"pose_tags": pose_tags}, final_text)

class AnimaPoseTagSelectorPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "pose_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, pose_tags, extra_text, separator=", "):
        tags_list = [t.strip() for t in pose_tags.split(",") if t.strip()]
        processed_tags = []

        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            if tag:
                processed_tags.append(tag)

        joined_pose = ", ".join(processed_tags)
        if joined_pose:
            joined_pose += ", "

        extra_text_clean = extra_text.strip() if extra_text else ""

        if extra_text_clean and joined_pose:
            sep = separator if separator is not None else ", "
            if sep.strip() == "," or sep.strip() == "":
                final_text = f"{joined_pose}{extra_text_clean}"
            else:
                final_text = f"{joined_pose.rstrip(', ')}{sep}{extra_text_clean}"
        elif extra_text_clean:
            final_text = extra_text_clean
        else:
            final_text = joined_pose

        return _anima_selector_tags_result({"pose_tags": pose_tags}, final_text)

class AnimaPromptPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "quality_prompt": ("STRING", {"multiline": True, "default": ""}),
                "artist_tags": ("STRING", {"multiline": True, "default": ""}),
                "character_tags": ("STRING", {"multiline": True, "default": ""}),
                "clothing_tags": ("STRING", {"multiline": True, "default": ""}),
                "pose_tags": ("STRING", {"multiline": True, "default": ""}),
                "background_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_prompt": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "compose_prompt"
    CATEGORY = "AnimaArt"

    def _split_prompt_tokens(self, value):
        normalized = str(value or "").replace("\r", ",").replace("\n", ",")
        return [
            part.replace("_raw_:", "", 1).strip()
            for part in normalized.split(",")
            if part.replace("_raw_:", "", 1).strip()
        ]

    def _artist_tokens(self, value):
        tokens = []
        for tag in self._split_prompt_tokens(value):
            if tag.startswith("@"):
                clean = tag[1:].strip()
            elif tag.lower().startswith("by "):
                clean = tag[3:].strip()
            else:
                clean = tag.strip()
            if clean:
                tokens.append(f"@{clean}")
        return tokens

    def compose_prompt(
        self,
        quality_prompt,
        artist_tags,
        character_tags,
        clothing_tags,
        pose_tags,
        background_tags,
        extra_prompt,
        separator=", ",
    ):
        selector_tags = {
            "artist_tags": artist_tags,
            "character_tags": character_tags,
            "clothing_tags": clothing_tags,
            "pose_tags": pose_tags,
            "background_tags": background_tags,
        }
        parts = []
        parts.extend(self._split_prompt_tokens(quality_prompt))
        parts.extend(self._artist_tokens(artist_tags))
        parts.extend(self._split_prompt_tokens(character_tags))
        parts.extend(self._split_prompt_tokens(clothing_tags))
        parts.extend(self._split_prompt_tokens(pose_tags))
        parts.extend(self._split_prompt_tokens(background_tags))
        parts.extend(self._split_prompt_tokens(extra_prompt))

        if not parts:
            return _anima_selector_tags_result(selector_tags, "")

        sep = separator if separator is not None else ", "
        if sep.strip() == "" or sep.strip() == ",":
            return _anima_selector_tags_result(selector_tags, f"{', '.join(parts)}, ")
        return _anima_selector_tags_result(selector_tags, sep.join(parts))

class AnimaPromptComposer:
    SELECTION_PROPERTY = "anima_prompt_composer_selection"
    SELECTION_SECTIONS = ("artist", "character", "clothing", "background", "pose")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_artist": ("BOOLEAN", {"default": True}),
                "enable_character": ("BOOLEAN", {"default": True}),
                "enable_clothing": ("BOOLEAN", {"default": True}),
                "enable_background": ("BOOLEAN", {"default": True}),
                "enable_pose": ("BOOLEAN", {"default": True}),
                "character_detail": (["trigger", "trigger_tags"], {"default": "trigger"}),
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "artist_count": ("INT", {"default": 1, "min": 0, "max": 20}),
                "preview_collapsed": ("BOOLEAN", {"default": False}),
                "resolved_prompt": ("STRING", {"multiline": True, "default": ""}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "compose_prompt"
    CATEGORY = "AnimaArt"
    _data_cache = {}

    @classmethod
    def IS_CHANGED(cls, *args, **kwargs):
        import hashlib
        import json
        import time

        try:
            seed = int(kwargs.get("seed", -1))
        except Exception:
            seed = -1
        if seed < 0:
            return time.time()

        cache_kwargs = {key: value for key, value in kwargs.items() if key not in ("preview_collapsed", "resolved_prompt")}
        payload = json.dumps(cache_kwargs, ensure_ascii=False, sort_keys=True, default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def _load_js_array(cls, filename):
        import json
        import os

        if filename in cls._data_cache:
            return cls._data_cache[filename]
        path = os.path.join(os.path.dirname(__file__), "js", filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            start = content.index("[")
            data, _ = json.JSONDecoder().raw_decode(content[start:])
        except Exception as e:
            print(f"[Anima Tools] Failed to load prompt composer data {filename}: {e}")
            return []
        if not isinstance(data, list):
            return []
        cls._data_cache[filename] = [item for item in data if isinstance(item, dict)]
        return cls._data_cache[filename]

    @classmethod
    def _load_json_object(cls, filename):
        import json
        import os

        cache_key = f"json:{filename}"
        if cache_key in cls._data_cache:
            return cls._data_cache[cache_key]
        path = os.path.join(os.path.dirname(__file__), "js", filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[Anima Tools] Failed to load prompt composer data {filename}: {e}")
            data = {}
        if not isinstance(data, dict):
            data = {}
        cls._data_cache[cache_key] = data
        return data

    def _split_prompt_tokens(self, value):
        if isinstance(value, list):
            parts = []
            for item in value:
                parts.extend(self._split_prompt_tokens(item))
            return parts
        return [
            part.replace("_raw_:", "", 1).strip()
            for part in str(value or "").split(",")
            if part.replace("_raw_:", "", 1).strip()
        ]

    def _normalize_text(self, value):
        return " ".join(str(value or "").strip().lower().replace("_", " ").split())

    def _official_character_key(self, item):
        return f"{self._normalize_text(item.get('name'))}||{self._normalize_text(item.get('copyright'))}"

    def _pick_items(self, data, count, rng):
        count = max(0, int(count or 0))
        if count <= 0 or not data:
            return []
        if count >= len(data):
            shuffled = data[:]
            rng.shuffle(shuffled)
            return shuffled
        return rng.sample(data, count)

    def _artist_entry(self, item):
        name = str(item.get("name") or "").strip()
        if not name:
            return None
        partition = item.get("p") or 1
        item_id = item.get("id") or ""
        return {
            "section": "artist",
            "key": f"artist:{item_id or name}",
            "title": name,
            "subtitle": f"{item.get('post_count', 0)} works" if item.get("post_count") else "",
            "preview": f"https://fastly.jsdelivr.net/gh/ThetaCursed/Anima-Assets@main/images/{partition}/{item_id}.webp" if item_id else "",
            "prompt_parts": [f"@{name}"],
        }

    def _character_entry(self, item, official_data):
        import urllib.parse

        name = str(item.get("name") or "").strip()
        if not name:
            return None
        copyright = str(item.get("copyright") or "").strip()
        official = official_data.get(self._official_character_key(item)) or {}
        trigger = official.get("trigger") or (f"{name}, {copyright}" if copyright else name)
        tags = self._split_prompt_tokens(official.get("tags"))
        if not tags:
            fallback = []
            if item.get("gender"):
                fallback.append(item.get("gender"))
            if item.get("hair"):
                fallback.append(f"{item.get('hair')} hair")
            if item.get("eye"):
                fallback.append(f"{item.get('eye')} eyes")
            tags = fallback
        raw_name = f"{name}, {copyright}" if copyright else name
        return {
            "section": "character",
            "key": f"character:{name}||{copyright}",
            "title": name,
            "subtitle": copyright,
            "preview": f"https://blobs.animadex.net/Outputs/thumbs/{urllib.parse.quote(raw_name, safe='')}.webp",
            "trigger_parts": self._split_prompt_tokens(trigger),
            "tag_parts": tags,
        }

    def _clothing_entry(self, item):
        item_id = str(item.get("id") or "").strip()
        title = str(item.get("name_zh") or item.get("name") or "").strip()
        if not title:
            return None
        return {
            "section": "clothing",
            "key": f"clothing:{item_id or title}",
            "title": title,
            "subtitle": str(item.get("name") or ""),
            "preview": str(item.get("preview") or ""),
            "prompt_parts": self._split_prompt_tokens(item.get("tags")),
        }

    def _background_entry(self, item):
        item_id = str(item.get("id") or "").strip()
        title = str(item.get("name_zh") or item.get("name") or "").strip()
        if not title:
            return None
        return {
            "section": "background",
            "key": f"background:{item_id or title}",
            "title": title,
            "subtitle": str(item.get("name") or ""),
            "preview": str(item.get("preview") or ""),
            "prompt_parts": self._split_prompt_tokens(item.get("tags")),
        }

    def _pose_entry(self, item):
        item_id = str(item.get("id") or "").strip()
        title = str(item.get("name_zh") or item.get("name") or "").strip()
        if not title:
            return None
        return {
            "section": "pose",
            "key": f"pose:{item_id or title}",
            "title": title,
            "subtitle": str(item.get("name") or ""),
            "preview": str(item.get("preview") or ""),
            "prompt_parts": self._split_prompt_tokens(item.get("tags")),
        }

    def _entry_parts(self, entry, section, character_detail):
        if section == "character":
            parts = self._split_prompt_tokens(entry.get("trigger_parts"))
            if character_detail == "trigger_tags":
                parts.extend(self._split_prompt_tokens(entry.get("tag_parts")))
            return parts
        return self._split_prompt_tokens(entry.get("prompt_parts"))

    def _append_parts(self, output_parts, seen, entries, section, character_detail):
        for entry in entries:
            for part in self._entry_parts(entry, section, character_detail):
                key = part.lower()
                if key and key not in seen:
                    seen.add(key)
                    output_parts.append(part)

    def _workflow_widget_index(self, name):
        order = [
            "enable_artist",
            "enable_character",
            "enable_clothing",
            "enable_background",
            "enable_pose",
            "character_detail",
            "seed",
            "artist_count",
            "preview_collapsed",
            "resolved_prompt",
        ]
        try:
            return order.index(name)
        except ValueError:
            return -1

    def _set_workflow_widget_value(self, workflow_node, widget_name, value):
        if not isinstance(workflow_node, dict):
            return
        widgets_values = workflow_node.get("widgets_values")
        if isinstance(widgets_values, list):
            index = self._workflow_widget_index(widget_name)
            if index < 0:
                return
            while len(widgets_values) <= index:
                widgets_values.append("")
            widgets_values[index] = value
        elif isinstance(widgets_values, dict):
            widgets_values[widget_name] = value

    def _find_workflow_node(self, workflow, unique_id):
        if not isinstance(workflow, dict):
            return None
        nodes = workflow.get("nodes")
        if not isinstance(nodes, list):
            return None
        unique_id_text = str(unique_id)
        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_id = node.get("id")
            if str(node_id) == unique_id_text:
                return node
        return None

    def _parse_selection_payload(self, value):
        import json

        if isinstance(value, dict):
            return value
        text = str(value or "").strip()
        if not text.startswith("{"):
            return None
        try:
            payload = json.loads(text)
        except Exception:
            return None
        return payload if isinstance(payload, dict) else None

    def _empty_selected(self, resolved_prompt=""):
        selected = {section: [] for section in self.SELECTION_SECTIONS}
        selected["_resolved_prompt"] = resolved_prompt
        return selected

    def _normalize_selected(self, selected, resolved_prompt=""):
        if not isinstance(selected, dict):
            return self._empty_selected(resolved_prompt)

        normalized = {}
        for section in self.SELECTION_SECTIONS:
            entries = selected.get(section)
            normalized[section] = entries if isinstance(entries, list) else []
        normalized["_resolved_prompt"] = resolved_prompt or str(selected.get("_resolved_prompt") or "")
        return normalized

    def _selection_from_workflow(self, extra_pnginfo, unique_id, resolved_prompt=""):
        if not isinstance(extra_pnginfo, dict):
            return None
        workflow_node = self._find_workflow_node(extra_pnginfo.get("workflow"), unique_id)
        properties = workflow_node.get("properties") if isinstance(workflow_node, dict) else None
        if not isinstance(properties, dict):
            return None
        selected = self._parse_selection_payload(properties.get(self.SELECTION_PROPERTY))
        if not selected:
            return None
        return self._normalize_selected(selected, resolved_prompt)

    def _record_resolved_prompt(self, prompt, extra_pnginfo, unique_id, resolved_prompt, selected):
        unique_id_text = str(unique_id) if unique_id is not None else ""
        selected = self._normalize_selected(selected, resolved_prompt)

        if isinstance(prompt, dict) and unique_id_text:
            prompt_node = prompt.get(unique_id_text) or prompt.get(unique_id)
            if isinstance(prompt_node, dict):
                inputs = prompt_node.setdefault("inputs", {})
                if isinstance(inputs, dict):
                    inputs["resolved_prompt"] = resolved_prompt

        if not isinstance(extra_pnginfo, dict):
            return

        record = {
            "node_id": unique_id_text,
            "resolved_prompt": resolved_prompt,
            "selected": selected,
        }
        records = extra_pnginfo.setdefault("anima_prompt_composer", {})
        if not isinstance(records, dict):
            records = {}
            extra_pnginfo["anima_prompt_composer"] = records
        records[unique_id_text or "last"] = record

        workflow = extra_pnginfo.get("workflow")
        workflow_node = self._find_workflow_node(workflow, unique_id_text)
        if workflow_node:
            self._set_workflow_widget_value(workflow_node, "resolved_prompt", resolved_prompt)
            properties = workflow_node.get("properties")
            if not isinstance(properties, dict):
                properties = {}
                workflow_node["properties"] = properties
            properties[self.SELECTION_PROPERTY] = selected

    def _truthy(self, value, default=False):
        if isinstance(value, bool):
            return value
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return value != 0
        value_text = str(value).strip().lower()
        if value_text in ("true", "1", "yes", "on"):
            return True
        if value_text in ("false", "0", "no", "off"):
            return False
        return default

    def _int_value(self, value, default=0):
        try:
            return int(value)
        except Exception:
            return default

    def _resolve_prompt_data(
        self,
        enable_artist,
        enable_character,
        enable_clothing,
        enable_background,
        enable_pose,
        character_detail,
        seed,
        artist_count,
    ):
        import random

        artist_data = self._load_js_array("data.js")
        character_data = self._load_js_array("character_data.js")
        clothing_data = self._load_js_array("clothing_data.js")
        background_data = self._load_js_array("background_data.js")
        pose_data = self._load_js_array("pose_data.js")
        official_data = self._load_json_object("character_official_data.json")

        seed_value = self._int_value(seed, -1)
        rng = random.SystemRandom() if seed_value < 0 else random.Random(seed_value)

        artist_items = self._pick_items(artist_data, self._int_value(artist_count, 1), rng) if self._truthy(enable_artist, True) else []
        character_items = self._pick_items(character_data, 1, rng) if self._truthy(enable_character, True) else []
        clothing_items = self._pick_items(clothing_data, 1, rng) if self._truthy(enable_clothing, True) else []
        background_items = self._pick_items(background_data, 1, rng) if self._truthy(enable_background, True) else []
        pose_items = self._pick_items(pose_data, 1, rng) if self._truthy(enable_pose, True) else []

        selected = {
            "artist": [entry for entry in (self._artist_entry(item) for item in artist_items) if entry],
            "character": [entry for entry in (self._character_entry(item, official_data) for item in character_items) if entry],
            "clothing": [entry for entry in (self._clothing_entry(item) for item in clothing_items) if entry],
            "background": [entry for entry in (self._background_entry(item) for item in background_items) if entry],
            "pose": [entry for entry in (self._pose_entry(item) for item in pose_items) if entry],
        }

        output_parts = []
        seen = set()
        self._append_parts(output_parts, seen, selected["artist"], "artist", character_detail)
        self._append_parts(output_parts, seen, selected["character"], "character", character_detail)
        self._append_parts(output_parts, seen, selected["clothing"], "clothing", character_detail)
        self._append_parts(output_parts, seen, selected["background"], "background", character_detail)
        self._append_parts(output_parts, seen, selected["pose"], "pose", character_detail)

        text = ", ".join(output_parts)
        if text:
            text += ", "

        selected["_resolved_prompt"] = text
        return selected, text

    def _extract_resolved_prompt_text(self, value):
        text = str(value or "")
        payload = self._parse_selection_payload(text)
        if not payload:
            return text
        if isinstance(payload, dict) and isinstance(payload.get("_resolved_prompt"), str):
            return payload.get("_resolved_prompt") or ""
        return text

    def compose_prompt(
        self,
        enable_artist,
        enable_character,
        enable_clothing,
        enable_background,
        enable_pose,
        character_detail,
        seed,
        artist_count,
        preview_collapsed,
        resolved_prompt="",
        prompt=None,
        extra_pnginfo=None,
        unique_id=None,
    ):
        text = self._extract_resolved_prompt_text(resolved_prompt)
        if text:
            selected = (
                self._selection_from_workflow(extra_pnginfo, unique_id, text)
                or self._normalize_selected(self._parse_selection_payload(resolved_prompt), text)
            )
        else:
            selected, text = self._resolve_prompt_data(
                enable_artist,
                enable_character,
                enable_clothing,
                enable_background,
                enable_pose,
                character_detail,
                seed,
                artist_count,
            )
        selected["_resolved_prompt"] = text
        self._record_resolved_prompt(prompt, extra_pnginfo, unique_id, text, selected)

        return {"ui": {"anima_prompt_composer": [selected], "resolved_prompt": [text]}, "result": (text,)}

class AnimaMultiLoraLoader:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "lora_list_json": ("STRING", {"default": "[]", "multiline": True}),
            }
        }

    RETURN_TYPES = ("MODEL",)
    RETURN_NAMES = ("MODEL",)
    FUNCTION = "load_loras"
    CATEGORY = "AnimaArt"

    def load_loras(self, model, lora_list_json):
        import json
        import comfy.sd
        import comfy.utils
        import folder_paths
        from .anima_lora_api import get_lora_save_dir
        
        try:
            loras = json.loads(lora_list_json)
        except Exception as e:
            print(f"[Anima Tools] Error parsing lora_list_json: {e}")
            loras = []
            
        current_model = model
        
        for lora_entry in loras:
            if not lora_entry.get("enabled", True):
                continue
                
            lora_name = lora_entry.get("name")
            strength_model = float(lora_entry.get("strength_model", 1.0))
            
            if not lora_name:
                continue
                
            # 查找 LoRA 文件路径
            lora_path = folder_paths.get_full_path("loras", lora_name)
            
            if not lora_path:
                custom_dir = get_lora_save_dir()
                candidate = os.path.join(custom_dir, lora_name)
                if os.path.isfile(candidate):
                    lora_path = candidate
                else:
                    candidate_rel = os.path.join(custom_dir, lora_name.replace("/", os.sep))
                    if os.path.isfile(candidate_rel):
                        lora_path = candidate_rel
            
            if not lora_path:
                # 模糊匹配
                found_match = False
                for system_lora in folder_paths.get_filename_list("loras"):
                    if os.path.basename(system_lora) == os.path.basename(lora_name):
                        lora_path = folder_paths.get_full_path("loras", system_lora)
                        found_match = True
                        break
                if not found_match:
                    print(f"[Anima Tools] LoRA file not found: {lora_name}, skipping.")
                    continue
                    
            try:
                print(f"[Anima Tools] Applying LoRA: {lora_name} -> Model Strength: {strength_model}")
                lora_data = comfy.utils.load_torch_file(lora_path, safe_load=True)
                current_model, _ = comfy.sd.load_lora_for_models(
                    current_model, None, lora_data, strength_model, 0.0
                )
            except Exception as e:
                print(f"[Anima Tools] Failed to load LoRA {lora_name}: {e}")
                
        return (current_model,)


NODE_CLASS_MAPPINGS = {
    "AnimaArtistTagSelector": AnimaArtistTagSelector,
    "AnimaArtistTagSelectorPlus": AnimaArtistTagSelectorPlus,
    "AnimaCharacterTagSelector": AnimaCharacterTagSelector,
    "AnimaCharacterTagSelectorPlus": AnimaCharacterTagSelectorPlus,
    "AnimaClothingTagSelector": AnimaClothingTagSelector,
    "AnimaClothingTagSelectorPlus": AnimaClothingTagSelectorPlus,
    "AnimaBackgroundTagSelector": AnimaBackgroundTagSelector,
    "AnimaBackgroundTagSelectorPlus": AnimaBackgroundTagSelectorPlus,
    "AnimaPoseTagSelector": AnimaPoseTagSelector,
    "AnimaPoseTagSelectorPlus": AnimaPoseTagSelectorPlus,
    "AnimaPromptPlus": AnimaPromptPlus,
    "AnimaPromptComposer": AnimaPromptComposer,
    "AnimaMultiLoraLoader": AnimaMultiLoraLoader
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AnimaArtistTagSelector": "Anima Artist Tag Selector",
    "AnimaArtistTagSelectorPlus": "Anima Artist Tag Selector+",
    "AnimaCharacterTagSelector": "Anima Character Tag Selector",
    "AnimaCharacterTagSelectorPlus": "Anima Character Tag Selector+",
    "AnimaClothingTagSelector": "Anima Clothing Tag Selector",
    "AnimaClothingTagSelectorPlus": "Anima Clothing Tag Selector+",
    "AnimaBackgroundTagSelector": "Anima Background Tag Selector",
    "AnimaBackgroundTagSelectorPlus": "Anima Background Tag Selector+",
    "AnimaPoseTagSelector": "Anima Pose Tag Selector",
    "AnimaPoseTagSelectorPlus": "Anima Pose Tag Selector+",
    "AnimaPromptPlus": "Anima Prompt Plus",
    "AnimaPromptComposer": "Anima Prompt Random Draw",
    "AnimaMultiLoraLoader": "Anima Multi LoRA Loader"
}

# ----------------- 后端持久化 API 路由 -----------------
import folder_paths
from server import PromptServer
from aiohttp import web
import json
import os
import hashlib
import re
import threading
import time
import urllib.parse
import urllib.request
from io import BytesIO
try:
    from PIL import Image
except ImportError:
    Image = None

SELECTOR_RANDOM_PROPERTY = "anima_selector_random"

SELECTOR_RANDOM_INPUTS = {
    "AnimaArtistTagSelector": {"artist": "artist_tags"},
    "AnimaArtistTagSelectorPlus": {"artist": "artist_tags"},
    "AnimaCharacterTagSelector": {"character": "character_tags"},
    "AnimaCharacterTagSelectorPlus": {"character": "character_tags"},
    "AnimaClothingTagSelector": {"clothing": "clothing_tags"},
    "AnimaClothingTagSelectorPlus": {"clothing": "clothing_tags"},
    "AnimaBackgroundTagSelector": {"background": "background_tags"},
    "AnimaBackgroundTagSelectorPlus": {"background": "background_tags"},
    "AnimaPoseTagSelector": {"pose": "pose_tags"},
    "AnimaPoseTagSelectorPlus": {"pose": "pose_tags"},
    "AnimaPromptPlus": {
        "artist": "artist_tags",
        "character": "character_tags",
        "clothing": "clothing_tags",
        "pose": "pose_tags",
        "background": "background_tags",
    },
}

SELECTOR_WIDGET_ORDERS = {
    "AnimaArtistTagSelector": ["artist_tags", "mode"],
    "AnimaArtistTagSelectorPlus": ["artist_tags", "extra_text", "separator"],
    "AnimaCharacterTagSelector": ["character_tags", "mode"],
    "AnimaCharacterTagSelectorPlus": ["character_tags", "extra_text", "separator"],
    "AnimaClothingTagSelector": ["clothing_tags", "mode"],
    "AnimaClothingTagSelectorPlus": ["clothing_tags", "extra_text", "separator"],
    "AnimaBackgroundTagSelector": ["background_tags", "mode"],
    "AnimaBackgroundTagSelectorPlus": ["background_tags", "extra_text", "separator"],
    "AnimaPoseTagSelector": ["pose_tags", "mode"],
    "AnimaPoseTagSelectorPlus": ["pose_tags", "extra_text", "separator"],
    "AnimaPromptPlus": [
        "quality_prompt",
        "artist_tags",
        "character_tags",
        "clothing_tags",
        "pose_tags",
        "background_tags",
        "extra_prompt",
        "separator",
    ],
}

def _selector_random_state(workflow_node):
    if not isinstance(workflow_node, dict):
        return {}
    properties = workflow_node.get("properties")
    if not isinstance(properties, dict):
        return {}
    state = properties.get(SELECTOR_RANDOM_PROPERTY)
    return state if isinstance(state, dict) else {}

def _selector_random_enabled(workflow_node, section):
    value = _selector_random_state(workflow_node).get(section)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or "").strip().lower() in ("true", "1", "yes", "on")

def _set_selector_workflow_widget_value(workflow_node, class_type, input_name, value):
    if not isinstance(workflow_node, dict):
        return
    widgets_values = workflow_node.get("widgets_values")
    if isinstance(widgets_values, dict):
        widgets_values[input_name] = value
        return
    if not isinstance(widgets_values, list):
        return
    order = SELECTOR_WIDGET_ORDERS.get(class_type) or []
    try:
        index = order.index(input_name)
    except ValueError:
        return
    while len(widgets_values) <= index:
        widgets_values.append("")
    widgets_values[index] = value

def _selector_random_text(composer, section):
    selected, text = composer._resolve_prompt_data(
        section == "artist",
        section == "character",
        section == "clothing",
        section == "background",
        section == "pose",
        "trigger",
        -1,
        1,
    )
    return text, selected.get(section, [])

def _record_selector_random(extra_pnginfo, node_id, class_type, section, input_name, text, selected):
    if not isinstance(extra_pnginfo, dict):
        return
    records = extra_pnginfo.setdefault("anima_selector_random", {})
    if not isinstance(records, dict):
        records = {}
        extra_pnginfo["anima_selector_random"] = records
    records[f"{node_id}:{section}"] = {
        "node_id": str(node_id),
        "class_type": class_type,
        "section": section,
        "input": input_name,
        "text": text,
        "selected": selected,
    }

def _resolve_anima_selector_random_nodes(prompt, extra_pnginfo, composer):
    workflow = extra_pnginfo.get("workflow") if isinstance(extra_pnginfo, dict) else None
    for node_id, node in list(prompt.items()):
        if not isinstance(node, dict):
            continue
        class_type = node.get("class_type")
        section_inputs = SELECTOR_RANDOM_INPUTS.get(class_type)
        if not section_inputs:
            continue

        workflow_node = composer._find_workflow_node(workflow, node_id)
        if not workflow_node:
            continue
        inputs = node.setdefault("inputs", {})
        if not isinstance(inputs, dict):
            continue

        for section, input_name in section_inputs.items():
            if not _selector_random_enabled(workflow_node, section):
                continue
            current_value = inputs.get(input_name)
            if isinstance(current_value, list):
                continue
            text, selected = _selector_random_text(composer, section)
            if not text:
                continue
            inputs[input_name] = text
            _set_selector_workflow_widget_value(workflow_node, class_type, input_name, text)
            _record_selector_random(extra_pnginfo, node_id, class_type, section, input_name, text, selected)

def _install_anima_prompt_composer_queue_resolver():
    if getattr(PromptServer.instance, "_anima_prompt_composer_resolver_installed", False):
        return
    PromptServer.instance._anima_prompt_composer_resolver_installed = True

    def resolve_anima_prompt_composer_nodes(json_data):
        try:
            prompt = json_data.get("prompt")
            if not isinstance(prompt, dict):
                return json_data

            extra_data = json_data.setdefault("extra_data", {})
            if not isinstance(extra_data, dict):
                return json_data
            extra_pnginfo = extra_data.setdefault("extra_pnginfo", {})
            if not isinstance(extra_pnginfo, dict):
                return json_data

            composer = AnimaPromptComposer()
            _resolve_anima_selector_random_nodes(prompt, extra_pnginfo, composer)

            for node_id, node in list(prompt.items()):
                if not isinstance(node, dict) or node.get("class_type") != "AnimaPromptComposer":
                    continue
                inputs = node.setdefault("inputs", {})
                if not isinstance(inputs, dict):
                    continue

                selected, resolved_prompt = composer._resolve_prompt_data(
                    inputs.get("enable_artist", True),
                    inputs.get("enable_character", True),
                    inputs.get("enable_clothing", True),
                    inputs.get("enable_background", True),
                    inputs.get("enable_pose", True),
                    inputs.get("character_detail", "trigger"),
                    inputs.get("seed", -1),
                    inputs.get("artist_count", 1),
                )
                inputs["resolved_prompt"] = resolved_prompt
                composer._record_resolved_prompt(
                    prompt,
                    extra_pnginfo,
                    node_id,
                    resolved_prompt,
                    selected,
                )
        except Exception as e:
            print(f"[Anima Tools] Failed to resolve random prompt metadata before queue: {e}")
        return json_data

    PromptServer.instance.add_on_prompt_handler(resolve_anima_prompt_composer_nodes)

_install_anima_prompt_composer_queue_resolver()

def get_favorites_path():
    try:
        user_dir = folder_paths.get_user_directory()
    except AttributeError:
        # 降级方案：寻找 ComfyUI 根目录下的 user 文件夹
        user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "user"))
        if not os.path.exists(user_dir):
            user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "user"))
    
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "anima_tools_favorites.json")

FAVORITE_SECTIONS = ["artist", "character", "lora", "clothing", "background", "pose"]

def get_default_favorites_data():
    return {
        "artist": {
            "groups": [{"id": "default", "name": "My Favorites", "isSystem": True}],
            "items": []
        },
        "character": {
            "groups": [{"id": "default", "name": "My Favorites", "isSystem": True}],
            "items": []
        },
        "lora": {
            "groups": [{"id": "default", "name": "My Favorites", "isSystem": True}],
            "items": []
        },
        "clothing": {
            "groups": [{"id": "default", "name": "My Favorites", "isSystem": True}],
            "items": []
        },
        "background": {
            "groups": [{"id": "default", "name": "My Favorites", "isSystem": True}],
            "items": []
        },
        "pose": {
            "groups": [{"id": "default", "name": "默认收藏", "isSystem": True}],
            "items": []
        }
    }

def normalize_favorites_data(data):
    default_data = get_default_favorites_data()
    if not isinstance(data, dict):
        data = {}
    normalized = {}
    for key in FAVORITE_SECTIONS:
        section = data.get(key)
        if not isinstance(section, dict):
            section = {}
        groups = section.get("groups")
        if not isinstance(groups, list):
            groups = default_data[key]["groups"].copy()
        elif not any(isinstance(g, dict) and g.get("id") == "default" for g in groups):
            groups = [default_data[key]["groups"][0], *groups]
        items = section.get("items")
        if not isinstance(items, list):
            items = []
        for g in groups:
            if isinstance(g, dict) and g.get("isSystem") and g.get("name") != "My Favorites":
                g["name"] = "My Favorites"
        normalized[key] = {"groups": groups, "items": items}
    return normalized

def load_favorites_data():
    path = get_favorites_path()
    if not os.path.exists(path):
        return get_default_favorites_data()
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
        if not content:
            return get_default_favorites_data()
        return normalize_favorites_data(json.loads(content))
    except Exception as e:
        print(f"[Anima Tools] Error reading favorites: {e}")
        return get_default_favorites_data()

def merge_favorites_data(existing, incoming):
    merged = normalize_favorites_data(existing)
    if not isinstance(incoming, dict):
        raise ValueError("Favorites payload must be a JSON object")
    for key in FAVORITE_SECTIONS:
        if key in incoming:
            section = incoming.get(key)
            if not isinstance(section, dict):
                raise ValueError(f"Favorites section '{key}' must be an object")
            merged[key] = normalize_favorites_data({key: section})[key]
    return merged

@PromptServer.instance.routes.get("/anima-tools/favorites")
async def get_favorites_api(request):
    return web.json_response(load_favorites_data())

@PromptServer.instance.routes.post("/anima-tools/favorites")
async def save_favorites_api(request):
    try:
        raw_body = await request.text()
        if not raw_body.strip():
            return web.json_response({"success": False, "error": "Empty favorites payload"}, status=400)
        try:
            body = json.loads(raw_body)
        except json.JSONDecodeError as decode_error:
            return web.json_response(
                {"success": False, "error": f"Invalid favorites payload: {decode_error}"},
                status=400,
            )
        path = get_favorites_path()
        data = merge_favorites_data(load_favorites_data(), body)
        if os.path.exists(path):
            backup_path = path + ".bak"
            try:
                with open(path, "r", encoding="utf-8") as src, open(backup_path, "w", encoding="utf-8") as dst:
                    dst.write(src.read())
            except Exception as backup_error:
                print(f"[Anima Tools] Warning: failed to backup favorites: {backup_error}")
        
        # 原子写入：先写入 .tmp 文件再覆盖
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        os.replace(tmp_path, path)
        return web.json_response({"success": True, "path": path})
    except Exception as e:
        print(f"[Anima Tools] Error saving favorites: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


ANIMADEX_CHARACTER_SEARCH_API = "https://animadex.net/api/characters/search"
_animadex_character_cache = {}
_animadex_character_cache_lock = threading.Lock()
_animadex_character_cache_ttl = 60 * 60 * 12

def _normalize_animadex_text(value: str) -> str:
    return " ".join(str(value or "").strip().lower().replace("_", " ").split())

def _animadex_character_cache_key(name: str, copyright: str) -> str:
    return f"{_normalize_animadex_text(name)}||{_normalize_animadex_text(copyright)}"

def _select_animadex_character_result(results: list, name: str, copyright: str) -> dict | None:
    if not results:
        return None

    target_name = _normalize_animadex_text(name)
    target_copyright = _normalize_animadex_text(copyright)
    target_trigger = _normalize_animadex_text(f"{name}, {copyright}" if copyright else name)
    target_slug = target_name.replace(" ", "_")

    for item in results:
        trigger = _normalize_animadex_text(item.get("trigger", ""))
        item_name = _normalize_animadex_text(item.get("name", ""))
        item_copyright = _normalize_animadex_text(item.get("copyright", ""))
        item_slug = _normalize_animadex_text(item.get("slug", "")).replace(" ", "_")
        if trigger == target_trigger:
            return item
        if item_slug == target_slug and (not target_copyright or item_copyright == target_copyright):
            return item
        if item_name == target_name and (not target_copyright or item_copyright == target_copyright):
            return item

    return results[0]

def _compact_animadex_character_item(item: dict | None) -> dict | None:
    if not item:
        return None
    return {
        "slug": item.get("slug", ""),
        "name": item.get("name", ""),
        "copyright": item.get("copyright", ""),
        "copyright_name": item.get("copyright_name", ""),
        "trigger": item.get("trigger", ""),
        "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
        "count": item.get("count", 0),
        "url": item.get("url", ""),
        "thumb_url": item.get("thumb_url", ""),
        "img_url": item.get("img_url", ""),
    }

def _fetch_animadex_character(name: str, copyright: str) -> dict | None:
    query_text = f"{name}, {copyright}" if copyright else name
    params = urllib.parse.urlencode({
        "q": query_text,
        "sort": "count",
        "page": "1",
    })
    url = f"{ANIMADEX_CHARACTER_SEARCH_API}?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ComfyUI-Anima-Tools/1.0 (+https://github.com/zhangp365/Comfyui-Anima-Tools)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        data = json.loads(resp.read().decode(charset, errors="replace"))
    return _compact_animadex_character_item(_select_animadex_character_result(data.get("results") or [], name, copyright))

@PromptServer.instance.routes.get("/anima-tools/character/official")
async def get_official_character_api(request):
    name = str(request.query.get("name", "")).strip()
    copyright = str(request.query.get("copyright", "")).strip()
    if not name:
        return web.json_response({"success": False, "error": "Missing character name"}, status=400)
    if len(name) > 160 or len(copyright) > 160:
        return web.json_response({"success": False, "error": "Query is too long"}, status=400)

    cache_key = _animadex_character_cache_key(name, copyright)
    now = time.time()
    with _animadex_character_cache_lock:
        cached = _animadex_character_cache.get(cache_key)
        if cached and now - cached.get("time", 0) < _animadex_character_cache_ttl:
            return web.json_response(cached["payload"])

    try:
        item = _fetch_animadex_character(name, copyright)
        payload = {"success": bool(item), "item": item}
        with _animadex_character_cache_lock:
            _animadex_character_cache[cache_key] = {"time": now, "payload": payload}
        return web.json_response(payload)
    except Exception as e:
        print(f"[Anima Tools] Error fetching AnimaDex official character tags: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=502)


# ----------------- LoRA 相关的 API 路由 -----------------
from .anima_lora_api import (
    search_civitai_loras,
    start_download_task,
    get_download_job_status,
    load_config as load_lora_config,
    save_config as save_lora_config,
    get_lora_save_dir,
    download_preview_image,
    fetch_civitai_model
)

def scan_loras_in_directory(directory: str) -> list:
    results = []
    if not directory or not os.path.isdir(directory):
        return results
    directory = os.path.abspath(directory)
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".safetensors"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, directory)
                rel_path = rel_path.replace(os.sep, "/")
                results.append(rel_path)
    return results

def get_anima_tools_user_dir() -> str:
    try:
        user_dir = folder_paths.get_user_directory()
    except AttributeError:
        user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "user"))
        if not os.path.exists(user_dir):
            user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "user"))
    cache_root = os.path.join(user_dir, "anima_tools")
    os.makedirs(cache_root, exist_ok=True)
    return cache_root

def get_custom_lora_dir_status() -> tuple[str, bool, str]:
    config = load_lora_config()
    custom_dir = config.get("custom_lora_dir", "").strip()
    if not custom_dir:
        return "", False, ""
    abs_custom_dir = os.path.abspath(os.path.expanduser(custom_dir))
    return custom_dir, os.path.isdir(abs_custom_dir), abs_custom_dir

def get_lora_root_infos() -> list[dict]:
    roots = []

    _, custom_dir_valid, custom_dir_abs = get_custom_lora_dir_status()
    if custom_dir_valid:
        roots.append({"path": custom_dir_abs, "source": "custom"})

    try:
        for path in folder_paths.get_folder_paths("loras"):
            if path and os.path.isdir(path):
                roots.append({"path": os.path.abspath(path), "source": "default"})
    except Exception:
        pass

    fallback = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "loras"))
    if os.path.isdir(fallback):
        roots.append({"path": fallback, "source": "default"})

    deduped = []
    seen = set()
    for root_info in roots:
        root = root_info["path"]
        key = os.path.normcase(os.path.abspath(root))
        if key not in seen:
            seen.add(key)
            deduped.append(root_info)
    return deduped

def get_lora_roots() -> list[str]:
    return [root_info["path"] for root_info in get_lora_root_infos()]

def scan_loras_with_info() -> list[dict]:
    results = []
    seen = set()
    for root_info in get_lora_root_infos():
        root = root_info["path"]
        source = root_info.get("source", "default")
        for rel_path in scan_loras_in_directory(root):
            if rel_path in seen:
                continue
            abs_path = os.path.join(root, rel_path.replace("/", os.sep))
            if not os.path.isfile(abs_path):
                continue
            seen.add(rel_path)
            results.append({"filename": rel_path, "abs_path": abs_path, "source": source})
    return results

def resolve_lora_abs_path(filename: str) -> str | None:
    if not filename:
        return None
    filename = filename.replace("\\", "/").strip()
    if not filename or filename.endswith("/"):
        return None

    _, custom_dir_valid, custom_dir_abs = get_custom_lora_dir_status()
    if custom_dir_valid:
        candidate = os.path.join(custom_dir_abs, filename.replace("/", os.sep))
        if os.path.exists(candidate):
            return candidate

    try:
        abs_path = folder_paths.get_full_path("loras", filename)
    except Exception:
        abs_path = None

    if abs_path and os.path.exists(abs_path):
        return abs_path

    for root in get_lora_roots():
        candidate = os.path.join(root, filename.replace("/", os.sep))
        if os.path.exists(candidate):
            return candidate
    return None

def find_companion_preview(abs_path: str) -> str | None:
    if not abs_path:
        return None
    base_no_ext = os.path.splitext(abs_path)[0]
    for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm"]:
        for suffix in ["", ".preview"]:
            preview_file = base_no_ext + suffix + ext
            if os.path.exists(preview_file):
                return preview_file
    return None

def get_preview_cache_key(abs_path: str, preview_file: str | None = None) -> str:
    stat_path = preview_file if preview_file and os.path.exists(preview_file) else abs_path
    try:
        stat = os.stat(stat_path)
        raw = f"{os.path.abspath(stat_path)}|{int(stat.st_mtime)}|{stat.st_size}"
    except OSError:
        raw = f"{os.path.abspath(stat_path)}|missing"
    return hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()[:20]

def make_display_name(filename: str) -> str:
    name = os.path.basename(filename.replace("\\", "/"))
    if name.lower().endswith(".safetensors"):
        name = name[:-12]
    return name

def read_lora_meta_summary(abs_path: str) -> tuple[str, dict]:
    meta_path = os.path.splitext(abs_path)[0] + ".json"
    if not os.path.exists(meta_path):
        return "missing", {}
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        model = data.get("model", {}) if isinstance(data, dict) else {}
        version = data.get("version", {}) if isinstance(data, dict) else {}
        creator = model.get("creator", {}) if isinstance(model.get("creator"), dict) else {}
        return "cached", {
            "name": model.get("name") or version.get("modelName") or "",
            "creator": creator.get("username") or "",
            "version": version.get("name") or "",
            "trained_words": version.get("trainedWords", [])[:8] if isinstance(version.get("trainedWords"), list) else [],
            "preview_url": (version.get("images") or [{}])[0].get("url", "") if isinstance(version.get("images"), list) and version.get("images") else ""
        }
    except Exception as e:
        print(f"[Anima Tools] Failed to read metadata summary for {abs_path}: {e}")
        return "missing", {}

@PromptServer.instance.routes.get("/anima-tools/lora/local")
async def lora_local_list_api(request):
    try:
        local_loras = [item["filename"] for item in scan_loras_with_info()]
        return web.json_response(local_loras)
    except Exception as e:
        print(f"[Anima Tools] Local LoRA List API error: {e}")
        return web.json_response([], status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/manifest")
async def lora_manifest_api(request):
    try:
        try:
            width = max(80, min(int(request.query.get("width", "320")), 1024))
        except (ValueError, TypeError):
            width = 320

        custom_dir, custom_dir_valid, custom_dir_abs = get_custom_lora_dir_status()
        items = []
        for info in scan_loras_with_info():
            filename = info["filename"]
            abs_path = info["abs_path"]
            try:
                stat = os.stat(abs_path)
            except OSError:
                continue

            preview_file = find_companion_preview(abs_path)
            cache_key = get_preview_cache_key(abs_path, preview_file)
            metadata_status, meta_summary = read_lora_meta_summary(abs_path)
            items.append({
                "filename": filename,
                "display_name": meta_summary.get("name") or make_display_name(filename),
                "size": stat.st_size,
                "mtime": int(stat.st_mtime),
                "cache_key": cache_key,
                "thumb_url": f"/anima-tools/lora/local-preview?filename={urllib.parse.quote(filename)}&width={width}&v={cache_key}",
                "has_preview": bool(preview_file),
                "metadata_status": metadata_status,
                "meta_summary": meta_summary,
                "source": info.get("source", "default"),
                "_preview_file": preview_file,
                "_abs_path": abs_path,
            })

        items.sort(key=lambda item: item["display_name"].lower())
        for item in items[:160]:
            preview_file = item.get("_preview_file")
            if preview_file and width > 0:
                _ensure_local_thumbnail_async(preview_file, width, delay=2.0)
            elif item.get("meta_summary", {}).get("preview_url"):
                _ensure_local_preview_download_async(item.get("_abs_path"), item["meta_summary"]["preview_url"], delay=3.0)
        for item in items:
            item.pop("_preview_file", None)
            item.pop("_abs_path", None)
        return web.json_response({
            "items": items,
            "count": len(items),
            "width": width,
            "custom_lora_dir": custom_dir,
            "custom_lora_dir_valid": custom_dir_valid,
            "custom_lora_dir_abs": custom_dir_abs if custom_dir_valid else "",
            "generated_at": int(time.time())
        })
    except Exception as e:
        print(f"[Anima Tools] LoRA Manifest API error: {e}")
        return web.json_response({"items": [], "error": str(e)}, status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/search")
async def lora_search_api(request):
    try:
        query = request.query.get("query", "")
        tag = request.query.get("tag", "")
        category = request.query.get("category", "")
        sort = request.query.get("sort", "Highest Rated")
        cursor = request.query.get("cursor", "")
        limit_str = request.query.get("limit", "40")
        try:
            limit = int(limit_str)
        except ValueError:
            limit = 40
            
        result = search_civitai_loras(query=query, tag=tag, category=category, sort=sort, cursor=cursor, limit=limit)
        return web.json_response(result or {"items": [], "metadata": {}})
    except Exception as e:
        print(f"[Anima Tools] Search API error: {e}")
        return web.json_response({"items": [], "error": str(e)}, status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/model-detail")
async def lora_model_detail_api(request):
    try:
        model_id = str(request.query.get("id", "")).strip()
        if not model_id or not model_id.isdigit():
            return web.json_response({"success": False, "error": "Missing model id"}, status=400)

        model = fetch_civitai_model(model_id)
        if not model or (isinstance(model, dict) and model.get("error")):
            return web.json_response({"success": False, "error": "Model detail not found"}, status=404)

        return web.json_response({"success": True, "model": model})
    except Exception as e:
        print(f"[Anima Tools] Model Detail API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/anima-tools/lora/download")
async def lora_download_api(request):
    try:
        body = await request.json()
        version_id = body.get("version_id")
        download_url = body.get("download_url")
        filename = body.get("filename")
        metadata = body.get("metadata")
        
        if not version_id or not download_url or not filename:
            return web.json_response({"success": False, "error": "Missing parameters"}, status=400)

        parsed_url = urllib.parse.urlparse(str(download_url))
        if parsed_url.scheme != "https" or parsed_url.netloc.lower() not in ("civitai.com", "www.civitai.com", "civitai.red"):
            return web.json_response({"success": False, "error": "Only Civitai HTTPS downloads are supported"}, status=400)
            
        task_id = start_download_task(version_id, download_url, filename, metadata=metadata)
        return web.json_response({"success": True, "task_id": task_id})
    except Exception as e:
        print(f"[Anima Tools] Download API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


_LOCAL_METADATA_CACHE = {}

def get_info_from_civitai_by_hash(file_hash: str) -> dict | None:
    import urllib.request
    import json
    url = f"https://civitai.red/api/v1/model-versions/by-hash/{file_hash}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

@PromptServer.instance.routes.get("/anima-tools/lora/local-metadata")
async def lora_local_metadata_api(request):
    try:
        filename = request.query.get("filename", "")
        if not filename:
            return web.json_response({"success": False, "error": "Missing filename"}, status=400)
            
        filename = filename.replace("\\", "/")
        
        # Try metadata cache first
        if filename in _LOCAL_METADATA_CACHE:
            return web.json_response({"success": True, "metadata": _LOCAL_METADATA_CACHE[filename]})
            
        abs_path = resolve_lora_abs_path(filename)
            
        if abs_path and os.path.exists(abs_path):
            meta_path = os.path.splitext(abs_path)[0] + ".json"
            
            # 1. 优先读取已存在的本地 JSON 配置文件（支持旧版格式自动升级与自愈）
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta_data = json.load(f)
                    # 检查是否是包含 files、modelVersions 和 creator（作者）的新版完整格式，如果是则直接返回
                    if (isinstance(meta_data, dict) and 
                        "version" in meta_data and "files" in meta_data["version"] and 
                        "model" in meta_data and "modelVersions" in meta_data["model"] and
                        "creator" in meta_data["model"]):
                        _LOCAL_METADATA_CACHE[filename] = meta_data
                        return web.json_response({"success": True, "metadata": meta_data})
                    else:
                        print(f"[Anima Tools] Legacy local metadata found for {filename}, regenerating to fetch complete fields...")
                except Exception:
                    pass
                
            # 2. 如果不存在（或为旧版非完整格式），计算 SHA256 哈希值，从 Civitai 反向抓取元数据
            print(f"[Anima Tools] Resolving complete metadata for {filename}...")
            try:
                h = hashlib.sha256()
                with open(abs_path, 'rb') as f:
                    for chunk in iter(lambda: f.read(4096 * 1024), b''): # 4MB chunk
                        h.update(chunk)
                file_hash = h.hexdigest().upper()
                
                info = get_info_from_civitai_by_hash(file_hash)
                if info and "error" not in info:
                    # 二次查询模型完整元数据，获取作者 (creator) 及其它版本详情和高质量预览图
                    model_id = info.get("modelId")
                    full_model = None
                    if model_id:
                        try:
                            full_model = fetch_civitai_model(model_id)
                        except Exception:
                            full_model = None
                            
                    # 组装符合前端所需的全包元数据格式
                    version_info = {
                        "id": info.get("id"),
                        "name": info.get("name"),
                        "trainedWords": info.get("trainedWords", []),
                        "images": info.get("images", []),
                        "files": info.get("files", []),
                        "downloadUrl": info.get("downloadUrl", ""),
                        "description": info.get("description", "")
                    }
                    
                    if full_model and "error" not in full_model:
                        model_info = full_model.copy()
                        # 补全或覆盖 modelVersions
                        model_info["modelVersions"] = full_model.get("modelVersions", [version_info])
                    else:
                        model_info = info.get("model", {}).copy()
                        model_info["modelVersions"] = [version_info]
                        model_info["description"] = info.get("description", "")
                    
                    meta_data = {
                        "model": model_info,
                        "version": version_info
                    }
                    # 自动保存本地同名 JSON 伴随文件，后续便可秒开
                    with open(meta_path, "w", encoding="utf-8") as f:
                        json.dump(meta_data, f, indent=2, ensure_ascii=False)
                        
                    # 尝试自动补齐本地 LoRA 的封面图！这样之前没有封面图的也能自动显示 C 站封面
                    images = info.get("images", [])
                    if images:
                        preview_url = images[0].get("url")
                        if preview_url:
                            preview_ext = ".png"
                            if ".jpg" in preview_url.lower() or ".jpeg" in preview_url.lower():
                                preview_ext = ".jpg"
                            elif ".webp" in preview_url.lower():
                                preview_ext = ".webp"
                            
                            preview_path = os.path.splitext(abs_path)[0] + preview_ext
                            if not os.path.exists(preview_path):
                                # 后台多线程异步下载图片，防止阻塞 metadata 请求
                                threading.Thread(
                                    target=download_preview_image,
                                    args=(preview_url, preview_path),
                                    daemon=True
                                ).start()
                                
                    _LOCAL_METADATA_CACHE[filename] = meta_data
                    return web.json_response({"success": True, "metadata": meta_data})
            except Exception as ex:
                print(f"[Anima Tools] Auto-metadata recovery failed for {filename}: {ex}")
                
        return web.json_response({"success": False, "error": "Metadata not found"}, status=404)
    except Exception as e:
        print(f"[Anima Tools] Get Local Metadata API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


# 缩略图磁盘缓存目录，放在 user 下以便 ComfyUI 重启和插件升级后继续复用
_THUMB_CACHE_DIR = os.path.join(get_anima_tools_user_dir(), "thumb_cache")
_REMOTE_THUMB_CACHE_DIR = os.path.join(get_anima_tools_user_dir(), "remote_thumb_cache")
_REMOTE_THUMB_INDEX_PATH = os.path.join(_REMOTE_THUMB_CACHE_DIR, "index.json")
_LOCAL_THUMB_JOBS = set()
_LOCAL_THUMB_QUEUE = []
_LOCAL_THUMB_WORKER_ACTIVE = False
_LOCAL_THUMB_LOCK = threading.Lock()
_LOCAL_PREVIEW_DOWNLOAD_JOBS = set()
_LOCAL_PREVIEW_DOWNLOAD_QUEUE = []
_LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE = False
_LOCAL_PREVIEW_DOWNLOAD_LOCK = threading.Lock()

def _preview_extension_from_url(url: str) -> str:
    lower = (url or "").lower()
    if ".jpg" in lower or ".jpeg" in lower:
        return ".jpg"
    if ".webp" in lower:
        return ".webp"
    return ".png"

def _local_preview_download_worker(delay: float = 0.0) -> None:
    global _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE
    if delay > 0:
        time.sleep(delay)
    while True:
        with _LOCAL_PREVIEW_DOWNLOAD_LOCK:
            if not _LOCAL_PREVIEW_DOWNLOAD_QUEUE:
                _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE = False
                return
            image_url, preview_path, job_key = _LOCAL_PREVIEW_DOWNLOAD_QUEUE.pop(0)
        try:
            if not os.path.exists(preview_path):
                download_preview_image(image_url, preview_path)
        finally:
            with _LOCAL_PREVIEW_DOWNLOAD_LOCK:
                _LOCAL_PREVIEW_DOWNLOAD_JOBS.discard(job_key)

def _ensure_local_preview_download_async(abs_path: str, image_url: str, delay: float = 3.0) -> None:
    global _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE
    if not abs_path or not image_url or not image_url.lower().startswith(("http://", "https://")):
        return
    preview_path = os.path.splitext(abs_path)[0] + _preview_extension_from_url(image_url)
    if os.path.exists(preview_path):
        return
    job_key = f"{preview_path}:{image_url}"
    with _LOCAL_PREVIEW_DOWNLOAD_LOCK:
        if job_key in _LOCAL_PREVIEW_DOWNLOAD_JOBS:
            return
        _LOCAL_PREVIEW_DOWNLOAD_JOBS.add(job_key)
        _LOCAL_PREVIEW_DOWNLOAD_QUEUE.append((image_url, preview_path, job_key))
        if _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE:
            return
        _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE = True
    threading.Thread(target=_local_preview_download_worker, args=(delay,), daemon=True).start()

def _thumbnail_cache_path(preview_file: str, target_width: int) -> str:
    stat = os.stat(preview_file)
    cache_key = hashlib.sha256(
        f"{os.path.abspath(preview_file)}|{int(stat.st_mtime)}|{stat.st_size}|{target_width}".encode("utf-8", errors="ignore")
    ).hexdigest()
    return os.path.join(_THUMB_CACHE_DIR, f"{cache_key}.webp")

def _get_thumbnail(preview_file: str, target_width: int, generate: bool = True) -> tuple[bytes, str] | None:
    """生成并缓存缩略图，返回 (图片bytes, content_type) 或 None"""
    if Image is None:
        return None

    # 视频文件不处理缩略图
    ext_lower = os.path.splitext(preview_file)[1].lower()
    if ext_lower in (".mp4", ".webm", ".gif"):
        return None

    # 检查磁盘缓存
    cache_path = _thumbnail_cache_path(preview_file, target_width)

    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return f.read(), "image/webp"
    if not generate:
        return None

    try:
        img = Image.open(preview_file)
        img = img.convert("RGB")
        if target_width > 0 and img.width > target_width:
            ratio = target_width / img.width
            new_size = (target_width, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="WEBP", quality=82)
        thumb_data = buf.getvalue()

        # 写入磁盘缓存
        os.makedirs(_THUMB_CACHE_DIR, exist_ok=True)
        with open(cache_path, "wb") as f:
            f.write(thumb_data)

        return thumb_data, "image/webp"
    except Exception as e:
        print(f"[Anima Tools] Thumbnail generation failed: {e}")
        return None

def _warm_local_thumbnail(preview_file: str, target_width: int) -> None:
    try:
        _get_thumbnail(preview_file, target_width, generate=True)
    finally:
        job_key = f"{preview_file}:{target_width}"
        with _LOCAL_THUMB_LOCK:
            _LOCAL_THUMB_JOBS.discard(job_key)

def _local_thumbnail_worker(delay: float = 0.0) -> None:
    global _LOCAL_THUMB_WORKER_ACTIVE
    if delay > 0:
        time.sleep(delay)
    while True:
        with _LOCAL_THUMB_LOCK:
            if not _LOCAL_THUMB_QUEUE:
                _LOCAL_THUMB_WORKER_ACTIVE = False
                return
            preview_file, target_width = _LOCAL_THUMB_QUEUE.pop(0)
        _warm_local_thumbnail(preview_file, target_width)

def _ensure_local_thumbnail_async(preview_file: str, target_width: int, delay: float = 0.0) -> None:
    global _LOCAL_THUMB_WORKER_ACTIVE
    if Image is None or target_width <= 0:
        return
    try:
        cache_path = _thumbnail_cache_path(preview_file, target_width)
        if os.path.exists(cache_path):
            return
    except Exception:
        return
    job_key = f"{preview_file}:{target_width}"
    with _LOCAL_THUMB_LOCK:
        if job_key in _LOCAL_THUMB_JOBS:
            return
        _LOCAL_THUMB_JOBS.add(job_key)
        _LOCAL_THUMB_QUEUE.append((preview_file, target_width))
        if _LOCAL_THUMB_WORKER_ACTIVE:
            return
        _LOCAL_THUMB_WORKER_ACTIVE = True
    threading.Thread(target=_local_thumbnail_worker, args=(delay,), daemon=True).start()

def _placeholder_svg_response(cache_control: str = "no-store") -> web.Response:
    svg_content = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>"
        "<rect width='100' height='100' fill='#222'/>"
        "<text x='50%' y='50%' font-size='10' fill='#666' dominant-baseline='middle' text-anchor='middle'>No Preview</text>"
        "</svg>"
    )
    return web.Response(body=svg_content, content_type="image/svg+xml", headers={"Cache-Control": cache_control})

_REMOTE_THUMB_JOBS = set()
_REMOTE_THUMB_LOCK = threading.Lock()
_REMOTE_THUMB_INDEX_LOCK = threading.Lock()
_CIVITAI_UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE
)

def _clear_cache_directory(directory: str) -> tuple[int, int, list[str]]:
    deleted_count = 0
    deleted_bytes = 0
    errors = []
    if not os.path.isdir(directory):
        return deleted_count, deleted_bytes, errors

    for name in os.listdir(directory):
        path = os.path.join(directory, name)
        if not os.path.isfile(path):
            continue
        try:
            deleted_bytes += os.path.getsize(path)
            os.remove(path)
            deleted_count += 1
        except Exception as e:
            errors.append(f"{name}: {e}")
    return deleted_count, deleted_bytes, errors

def _remote_thumb_cache_path(cache_key: str, width: int) -> str:
    safe_key = "".join(ch for ch in cache_key if ch.isalnum())[:80] or "remote"
    return os.path.join(_REMOTE_THUMB_CACHE_DIR, f"{safe_key}_{width}.webp")

def _remote_thumb_content_cache_path(content_hash: str, width: int) -> str:
    safe_hash = "".join(ch for ch in content_hash if ch.isalnum())[:80] or "content"
    return os.path.join(_REMOTE_THUMB_CACHE_DIR, f"content_{safe_hash}_{width}.webp")

def _remote_thumb_index_key(cache_key: str, width: int) -> str:
    return f"{cache_key}:{width}"

def _load_remote_thumb_index_unlocked() -> dict:
    try:
        if not os.path.exists(_REMOTE_THUMB_INDEX_PATH):
            return {}
        with open(_REMOTE_THUMB_INDEX_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def _save_remote_thumb_index_unlocked(index: dict) -> None:
    os.makedirs(_REMOTE_THUMB_CACHE_DIR, exist_ok=True)
    tmp_path = _REMOTE_THUMB_INDEX_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp_path, _REMOTE_THUMB_INDEX_PATH)

def _set_remote_thumb_index(cache_key: str, width: int, cache_path: str) -> None:
    if not cache_key or not cache_path:
        return
    with _REMOTE_THUMB_INDEX_LOCK:
        index = _load_remote_thumb_index_unlocked()
        index[_remote_thumb_index_key(cache_key, width)] = os.path.basename(cache_path)
        _save_remote_thumb_index_unlocked(index)

def _find_remote_thumb_indexed_path(cache_key: str, width: int) -> str:
    if not cache_key:
        return ""
    direct_path = _remote_thumb_cache_path(cache_key, width)
    if os.path.exists(direct_path):
        return direct_path
    with _REMOTE_THUMB_INDEX_LOCK:
        index = _load_remote_thumb_index_unlocked()
        cached_name = index.get(_remote_thumb_index_key(cache_key, width))
    if not cached_name:
        return ""
    indexed_path = os.path.join(_REMOTE_THUMB_CACHE_DIR, os.path.basename(cached_name))
    return indexed_path if os.path.exists(indexed_path) else ""

def _find_remote_thumb_cache(cache_keys: list[str], width: int) -> tuple[str, str]:
    for cache_key in cache_keys:
        cache_path = _find_remote_thumb_indexed_path(cache_key, width)
        if cache_path:
            return cache_path, cache_key
    return "", ""

def _extract_civitai_image_id(url: str) -> str:
    if not url or "civitai" not in url.lower():
        return ""
    try:
        parsed = urllib.parse.urlparse(url)
        path = urllib.parse.unquote(parsed.path or "")
    except Exception:
        path = str(url)

    cache_match = re.search(r"/civitai-media-cache/([^/]+)", path, re.IGNORECASE)
    if cache_match:
        return cache_match.group(1)

    uuid_match = _CIVITAI_UUID_RE.search(path)
    if uuid_match:
        return uuid_match.group(0).lower()

    numeric_match = re.search(r"/images/(\d+)", path, re.IGNORECASE)
    if numeric_match:
        return numeric_match.group(1)
    return ""

def _normalize_remote_source_url(url: str) -> str:
    try:
        parsed = urllib.parse.urlparse(url)
        query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        query = [
            (key, value)
            for key, value in query
            if key.lower() not in {"width", "height", "format", "quality"}
        ]
        query.sort()
        return urllib.parse.urlunparse((
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            urllib.parse.unquote(parsed.path or ""),
            "",
            urllib.parse.urlencode(query),
            ""
        ))
    except Exception:
        return url

def _remote_thumb_stable_cache_key(source_url: str, image_id: str = "", url_hash: str = "") -> str:
    stable_image_id = image_id or _extract_civitai_image_id(source_url)
    if stable_image_id:
        safe_image_id = "".join(ch for ch in stable_image_id if ch.isalnum()).lower()
        if safe_image_id:
            return f"civitai{safe_image_id}"
    if source_url:
        normalized_url = _normalize_remote_source_url(source_url)
        return hashlib.sha256(normalized_url.encode("utf-8", errors="ignore")).hexdigest()
    return "".join(ch for ch in url_hash if ch.isalnum()) or ""

def _remote_thumb_cache_keys(source_url: str, image_id: str, url_hash: str) -> list[str]:
    keys = []
    stable_key = _remote_thumb_stable_cache_key(source_url, image_id, url_hash)
    if stable_key:
        keys.append(stable_key)
    if source_url:
        legacy_key = hashlib.sha256(source_url.encode("utf-8", errors="ignore")).hexdigest()
        keys.append(legacy_key)
    if url_hash:
        keys.append(url_hash)

    unique_keys = []
    for key in keys:
        if key and key not in unique_keys:
            unique_keys.append(key)
    return unique_keys

def _write_remote_thumbnail_content(cache_key: str, width: int, thumb_data: bytes) -> str:
    os.makedirs(_REMOTE_THUMB_CACHE_DIR, exist_ok=True)
    content_hash = hashlib.sha256(thumb_data).hexdigest()
    content_path = _remote_thumb_content_cache_path(content_hash, width)
    if not os.path.exists(content_path):
        tmp_path = content_path + ".tmp"
        with open(tmp_path, "wb") as f:
            f.write(thumb_data)
        os.replace(tmp_path, content_path)
    _set_remote_thumb_index(cache_key, width, content_path)
    return content_path

def _download_remote_thumbnail(url: str, cache_key: str, width: int, job_key: str) -> None:
    try:
        if Image is None:
            return
        if _find_remote_thumb_indexed_path(cache_key, width):
            return
        req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Anima-Tools/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()

        img = Image.open(BytesIO(data)).convert("RGB")
        if width > 0 and img.width > width:
            ratio = width / img.width
            img = img.resize((width, int(img.height * ratio)), Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="WEBP", quality=82)
        _write_remote_thumbnail_content(cache_key, width, buf.getvalue())
    except Exception as e:
        print(f"[Anima Tools] Remote preview cache failed: {e}")
    finally:
        with _REMOTE_THUMB_LOCK:
            _REMOTE_THUMB_JOBS.discard(job_key)

@PromptServer.instance.routes.get("/anima-tools/lora/remote-preview")
async def lora_remote_preview_api(request):
    try:
        try:
            width = max(80, min(int(request.query.get("width", "320")), 1024))
        except (ValueError, TypeError):
            width = 320

        source_url = request.query.get("url", "").strip()
        url_hash = request.query.get("url_hash", "").strip()
        image_id = request.query.get("image_id", "").strip()
        miss_mode = request.query.get("miss", "").strip().lower()
        cache_keys = _remote_thumb_cache_keys(source_url, image_id, url_hash)

        if not cache_keys:
            return _placeholder_svg_response()

        cache_key = cache_keys[0]
        cache_path, matched_key = _find_remote_thumb_cache(cache_keys, width)
        if cache_path:
            if matched_key != cache_key:
                _set_remote_thumb_index(cache_key, width, cache_path)
            resp = web.FileResponse(cache_path)
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp

        if source_url and source_url.lower().startswith(("http://", "https://")):
            if Image is None:
                raise web.HTTPFound(source_url)
            job_key = f"{cache_key}:{width}"
            with _REMOTE_THUMB_LOCK:
                if job_key not in _REMOTE_THUMB_JOBS:
                    _REMOTE_THUMB_JOBS.add(job_key)
                    threading.Thread(
                        target=_download_remote_thumbnail,
                        args=(source_url, cache_key, width, job_key),
                        daemon=True
                    ).start()

        if miss_mode == "error":
            return web.Response(status=202, headers={"Cache-Control": "no-store", "Retry-After": "1"})
        return _placeholder_svg_response("no-store")
    except web.HTTPException:
        raise
    except Exception as e:
        print(f"[Anima Tools] Remote Preview API error: {e}")
        return _placeholder_svg_response()

@PromptServer.instance.routes.get("/anima-tools/lora/local-preview")
async def lora_local_preview_api(request):
    try:
        filename = request.query.get("filename", "")
        if not filename:
            return web.Response(status=400)
        
        # 解析目标缩略图宽度（默认不缩放以保持向后兼容）
        try:
            target_width = int(request.query.get("width", "0"))
        except (ValueError, TypeError):
            target_width = 0
            
        filename = filename.replace("\\", "/")
        abs_path = resolve_lora_abs_path(filename)
            
        if abs_path and os.path.exists(abs_path):
            preview_file = find_companion_preview(abs_path)
            if preview_file:
                immutable_cache = "public, max-age=31536000, immutable" if request.query.get("v") else "public, max-age=86400"
                if target_width > 0:
                    thumb = _get_thumbnail(preview_file, target_width, generate=False)
                    if thumb:
                        thumb_data, content_type = thumb
                        return web.Response(
                            body=thumb_data,
                            content_type=content_type,
                            headers={"Cache-Control": immutable_cache}
                        )
                resp = web.FileResponse(preview_file)
                resp.headers["Cache-Control"] = immutable_cache
                return resp
                    
        # 找不到本地预览图时，返回默认的 No Preview 占位图，状态设为 200，防止控制台大量 404 报错
        return _placeholder_svg_response("public, max-age=3600")
    except Exception as e:
        print(f"[Anima Tools] Local Preview API error: {e}")
        return web.Response(status=500)

@PromptServer.instance.routes.post("/anima-tools/lora/clear-cache")
async def lora_clear_cache_api(request):
    try:
        with _LOCAL_THUMB_LOCK:
            _LOCAL_THUMB_JOBS.clear()
            _LOCAL_THUMB_QUEUE.clear()
        with _REMOTE_THUMB_LOCK:
            _REMOTE_THUMB_JOBS.clear()

        local_count, local_bytes, local_errors = _clear_cache_directory(_THUMB_CACHE_DIR)
        remote_count, remote_bytes, remote_errors = _clear_cache_directory(_REMOTE_THUMB_CACHE_DIR)
        errors = local_errors + remote_errors

        return web.json_response({
            "success": len(errors) == 0,
            "deleted_files": local_count + remote_count,
            "deleted_bytes": local_bytes + remote_bytes,
            "local_thumb_cache": {
                "path": _THUMB_CACHE_DIR,
                "deleted_files": local_count,
                "deleted_bytes": local_bytes,
            },
            "remote_thumb_cache": {
                "path": _REMOTE_THUMB_CACHE_DIR,
                "deleted_files": remote_count,
                "deleted_bytes": remote_bytes,
            },
            "errors": errors[:20],
        })
    except Exception as e:
        print(f"[Anima Tools] Clear LoRA cache API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/download-status")
async def lora_download_status_api(request):
    try:
        task_id = request.query.get("task_id", "")
        if not task_id:
            from .anima_lora_api import get_all_download_jobs
            return web.json_response(get_all_download_jobs())
            
        status_info = get_download_job_status(task_id)
        if not status_info:
            return web.json_response({"status": "not_found"}, status=404)
        return web.json_response(status_info)
    except Exception as e:
        print(f"[Anima Tools] Download Status API error: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/config")
async def lora_get_config_api(request):
    try:
        config = dict(load_lora_config())
        config["resolved_save_dir"] = get_lora_save_dir()
        custom_dir, custom_dir_valid, custom_dir_abs = get_custom_lora_dir_status()
        config["custom_lora_dir"] = custom_dir
        config["custom_lora_dir_valid"] = custom_dir_valid
        config["custom_lora_dir_abs"] = custom_dir_abs if custom_dir_valid else ""
        return web.json_response(config)
    except Exception as e:
        print(f"[Anima Tools] Get Config API error: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/anima-tools/lora/config")
async def lora_save_config_api(request):
    try:
        body = await request.json()
        current_config = load_lora_config()
        config = {
            "custom_lora_dir": current_config.get("custom_lora_dir", ""),
            "civitai_api_key": current_config.get("civitai_api_key", "")
        }
        if "custom_lora_dir" in body:
            config["custom_lora_dir"] = body["custom_lora_dir"]
        if "civitai_api_key" in body:
            config["civitai_api_key"] = body["civitai_api_key"]
            
        success = save_lora_config(config)
        custom_dir, custom_dir_valid, custom_dir_abs = get_custom_lora_dir_status()
        return web.json_response({
            "success": success,
            "resolved_save_dir": get_lora_save_dir(),
            "custom_lora_dir": custom_dir,
            "custom_lora_dir_valid": custom_dir_valid,
            "custom_lora_dir_abs": custom_dir_abs if custom_dir_valid else ""
        })
    except Exception as e:
        print(f"[Anima Tools] Save Config API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


def delete_local_lora_files(filename: str) -> bool:
    """Helper to delete a local LoRA model and its companion meta files."""
    try:
        # 统一将反斜杠替换为正斜杠，防止 Windows 路径转义解析错误
        filename = filename.replace("\\", "/")
        
        # Invalidate metadata cache
        _LOCAL_METADATA_CACHE.pop(filename, None)
        
        abs_path = resolve_lora_abs_path(filename)
            
        if not abs_path:
            return False
            
        abs_path = os.path.normpath(abs_path)
        
        if not os.path.exists(abs_path):
            # 如果主模型文件都不存在，我们也尝试看看有没有残留的伴随文件
            print(f"[Anima Tools] Model file {abs_path} not found, checking companion files...")
            
        # 1. 尝试删除 companion JSON metadata
        base_no_ext = os.path.splitext(abs_path)[0]
        meta_file = base_no_ext + ".json"
        deleted_any = False
        
        if os.path.exists(meta_file):
            try:
                os.remove(meta_file)
                print(f"[Anima Tools] Successfully deleted companion meta JSON: {meta_file}")
                deleted_any = True
            except Exception as e:
                print(f"[Anima Tools] Failed to delete companion meta JSON {meta_file}: {e}")
                
        # 2. 尝试删除 companion preview images (支持同名和带 .preview 后缀的预览图)
        preview_extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm"]
        for ext in preview_extensions:
            for suffix in ["", ".preview"]:
                preview_file = base_no_ext + suffix + ext
                if os.path.exists(preview_file):
                    try:
                        os.remove(preview_file)
                        print(f"[Anima Tools] Successfully deleted preview image: {preview_file}")
                        deleted_any = True
                    except Exception as e:
                        print(f"[Anima Tools] Failed to delete preview image {preview_file}: {e}")
                    
        # 3. 尝试删除主模型文件
        model_deleted = False
        if os.path.exists(abs_path):
            try:
                os.remove(abs_path)
                print(f"[Anima Tools] Successfully deleted main model file: {abs_path}")
                model_deleted = True
            except Exception as e:
                print(f"[Anima Tools] Failed to delete main model file {abs_path} (it might be locked or in-use by ComfyUI): {e}")
                
        return model_deleted or deleted_any
    except Exception as e:
        print(f"[Anima Tools] Error deleting local LoRA files: {e}")
        return False


@PromptServer.instance.routes.post("/anima-tools/lora/delete-local")
async def lora_delete_local_api(request):
    try:
        body = await request.json()
        filename = body.get("filename", "")
        if not filename:
            return web.json_response({"success": False, "error": "Missing filename"}, status=400)
            
        success = delete_local_lora_files(filename)
        if success:
            # Refresh local lists in memory if cached, though ComfyUI usually handles dynamically
            return web.json_response({"success": True})
        else:
            return web.json_response({"success": False, "error": "File not found or failed to delete"}, status=404)
    except Exception as e:
        print(f"[Anima Tools] Delete Local API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


