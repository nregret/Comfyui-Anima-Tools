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

    def _selector_tags(self, artist_tags, character_tags, clothing_tags, pose_tags, background_tags):
        return {
            "artist_tags": artist_tags,
            "character_tags": character_tags,
            "clothing_tags": clothing_tags,
            "pose_tags": pose_tags,
            "background_tags": background_tags,
        }

    def _compose_prompt_text(
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
        parts = []
        parts.extend(self._split_prompt_tokens(quality_prompt))
        parts.extend(self._artist_tokens(artist_tags))
        parts.extend(self._split_prompt_tokens(character_tags))
        parts.extend(self._split_prompt_tokens(clothing_tags))
        parts.extend(self._split_prompt_tokens(pose_tags))
        parts.extend(self._split_prompt_tokens(background_tags))
        parts.extend(self._split_prompt_tokens(extra_prompt))

        if not parts:
            return ""

        sep = separator if separator is not None else ", "
        if sep.strip() == "" or sep.strip() == ",":
            return f"{', '.join(parts)}, "
        return sep.join(parts)

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
        selector_tags = self._selector_tags(
            artist_tags,
            character_tags,
            clothing_tags,
            pose_tags,
            background_tags,
        )
        text = self._compose_prompt_text(
            quality_prompt,
            artist_tags,
            character_tags,
            clothing_tags,
            pose_tags,
            background_tags,
            extra_prompt,
            separator,
        )
        return _anima_selector_tags_result(selector_tags, text)


class AnimaPromptPlusClipEncode(AnimaPromptPlus):
    @classmethod
    def INPUT_TYPES(cls):
        prompt_inputs = super().INPUT_TYPES()["required"]
        return {
            "required": {
                "clip": ("CLIP",),
                **prompt_inputs,
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("CONDITIONING", "STRING")
    RETURN_NAMES = ("positive", "text")
    FUNCTION = "encode_prompt"
    CATEGORY = "AnimaArt"

    def _record_prompt_metadata(self, extra_pnginfo, unique_id, text):
        if not isinstance(extra_pnginfo, dict):
            return
        records = extra_pnginfo.setdefault("anima_prompt", {})
        if not isinstance(records, dict):
            records = {}
            extra_pnginfo["anima_prompt"] = records
        records[str(unique_id or "prompt")] = {"positive": text}

    def encode_prompt(
        self,
        clip,
        quality_prompt,
        artist_tags,
        character_tags,
        clothing_tags,
        pose_tags,
        background_tags,
        extra_prompt,
        separator=", ",
        extra_pnginfo=None,
        unique_id=None,
    ):
        if clip is None:
            raise RuntimeError(
                "ERROR: clip input is invalid: None\n\n"
                "Connect a valid CLIP output from a checkpoint or text encoder loader."
            )

        selector_tags = self._selector_tags(
            artist_tags,
            character_tags,
            clothing_tags,
            pose_tags,
            background_tags,
        )
        resolved_text = self._compose_prompt_text(
            quality_prompt,
            artist_tags,
            character_tags,
            clothing_tags,
            pose_tags,
            background_tags,
            extra_prompt,
            separator,
        )
        conditioning = clip.encode_from_tokens_scheduled(clip.tokenize(resolved_text))
        self._record_prompt_metadata(extra_pnginfo, unique_id, resolved_text)
        return {
            "ui": {"anima_selector_tags": [selector_tags]},
            "result": (conditioning, resolved_text),
        }

class AnimaPromptComposer:
    SELECTION_PROPERTY = "anima_prompt_composer_selection"
    SELECTION_SECTIONS = ("artist", "character", "clothing", "background", "pose")

    CHARACTER_DETAIL_MODES = ("trigger", "trigger_tags", "trigger_random_tags")
    CLOTHING_SOURCES = ("author", "danbooru", "character_tags", "random")
    DANBOORU_ATTIRE_FILE = "danbooru_attire_data.json"
    DANBOORU_VOCABULARY_KEY = "vocabulary"
    DANBOORU_SLOT_ORDER = ("decoration", "top", "bottom", "socks", "shoes", "uniform", "traditional")
    # "top_bottom" pairs a random top with a random bottom and counts as a single
    # outfit category, exactly like "uniform" and "traditional" do.
    DANBOORU_MAIN_VARIANTS = ("top_bottom", "uniform", "traditional")
    # Slot -> chance of being layered on top of the main outfit.  The plain
    # "decoration" slot is always added, legwear and footwear are optional so that
    # outfits do not all end up looking identical.
    DANBOORU_LAYERED_SLOTS = (("decoration", 1.0), ("socks", 0.6), ("shoes", 0.6))

    # Danbooru tags that describe the depicted person instead of the outfit.
    GENDER_TAGS = frozenset(
        (
            "1boy",
            "1girl",
            "1other",
            "2boys",
            "2girls",
            "androgynous",
            "female",
            "female focus",
            "genderbend",
            "male",
            "male focus",
            "multiple boys",
            "multiple girls",
        )
    )
    # Character identity clues: any word starting with one of these prefixes, or
    # any tag containing one of the keywords, stays next to the trigger instead of
    # being shuffled into the random tag pool.
    CHARACTER_FEATURE_WORD_PREFIXES = ("eye", "hair")
    CHARACTER_FEATURE_KEYWORDS = (
        "ahoge",
        "bangs",
        "braid",
        "braids",
        "hair bun",
        "hime cut",
        "one side up",
        "ponytail",
        "sidelocks",
        "twintails",
        "updo",
    )
    # A character's official tag list is a union over thousands of posts, so it
    # often holds several competing colourings ("grey eyes" *and* "purple eyes").
    # Colour tags are collapsed down to a single random pick per attribute.
    CHARACTER_FEATURE_COLOUR_TARGETS = ("eye", "eyes", "hair")
    CHARACTER_COLOUR_WORDS = frozenset(
        (
            "aqua",
            "black",
            "blonde",
            "blue",
            "brown",
            "cyan",
            "gray",
            "green",
            "grey",
            "indigo",
            "lavender",
            "magenta",
            "maroon",
            "orange",
            "pink",
            "purple",
            "red",
            "silver",
            "teal",
            "turquoise",
            "violet",
            "white",
            "yellow",
        )
    )

    # Every input that feeds the resolved prompt.  The queue hook can only draw a
    # prompt while all of them hold a value: a linked input is still
    # ``[node_id, output_index]`` until execution, see
    # ``_resolve_anima_prompt_composer_nodes``.
    QUEUE_RESOLVE_INPUTS = (
        "enable_artist",
        "enable_character",
        "enable_clothing",
        "enable_background",
        "enable_pose",
        "character_detail",
        "seed",
        "artist_count",
        "character_seed",
        "character_tag_count",
        "character_keep_features",
        "clothing_seed",
        "clothing_source",
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_artist": ("BOOLEAN", {"default": True}),
                "enable_character": ("BOOLEAN", {"default": True}),
                "enable_clothing": ("BOOLEAN", {"default": True}),
                "enable_background": ("BOOLEAN", {"default": True}),
                "enable_pose": ("BOOLEAN", {"default": True}),
                "character_detail": (list(cls.CHARACTER_DETAIL_MODES), {"default": "trigger"}),
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "artist_count": ("INT", {"default": 1, "min": 0, "max": 20}),
                "preview_collapsed": ("BOOLEAN", {"default": False}),
                "resolved_prompt": ("STRING", {"multiline": True, "default": ""}),
            },
            # The 3.3.0 widgets are appended *here* rather than kept in `required`:
            # ComfyUI answers a required input that is absent from a prompt with
            # `required_input_missing`, and Python argument defaults do not bypass
            # that check, so an API prompt saved with 3.2.9 would stop validating.
            # A missing optional input is skipped by validation and filled in by
            # the `compose_prompt` signature at execution time.  The frontend reads
            # both dicts in order (required first, then optional), and every new
            # name is appended to the end of its dict, so the widget order - and
            # with it the `widgets_values` layout of saved workflows - is
            # unchanged.  Keep this order in sync with _workflow_widget_index().
            "optional": {
                "character_seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "character_tag_count": ("INT", {"default": 3, "min": 0, "max": 30}),
                "character_keep_features": ("BOOLEAN", {"default": True}),
                "clothing_seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "clothing_source": (list(cls.CLOTHING_SOURCES), {"default": "author"}),
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

    def _section_rng(self, override_seed, master_rng):
        """RNG used by one section.

        A negative override keeps the section on the shared master RNG, which
        preserves the historical draw order.  A non negative override gives the
        section its own reproducible stream, so character and clothing seeds can be
        locked and rerolled independently of each other.
        """
        override = self._int_value(override_seed, -1)
        if override < 0:
            return master_rng
        import random

        return random.Random(override)

    def _dedupe_prompt_tokens(self, value):
        unique = []
        seen = set()
        for part in self._split_prompt_tokens(value):
            key = part.lower()
            if key and key not in seen:
                seen.add(key)
                unique.append(part)
        return unique

    def _is_gender_tag(self, tag):
        return self._normalize_text(tag) in self.GENDER_TAGS

    def _is_character_feature_tag(self, tag):
        text = self._normalize_text(tag)
        if not text:
            return False
        for word in text.split():
            if word.startswith(self.CHARACTER_FEATURE_WORD_PREFIXES):
                return True
        return any(keyword in text for keyword in self.CHARACTER_FEATURE_KEYWORDS)

    def _split_character_tags(self, tags):
        """Split one character's official tags into identity clues and outfit tags."""
        features = []
        outfit = []
        for tag in self._dedupe_prompt_tokens(tags):
            if self._is_gender_tag(tag):
                continue
            if self._is_character_feature_tag(tag):
                features.append(tag)
            else:
                outfit.append(tag)
        return features, outfit

    def _character_feature_colour_group(self, tag):
        """Return ``"eyes"``/``"hair"`` when a tag is a competing colouring, else None."""
        words = self._normalize_text(tag).split()
        if len(words) < 2 or words[-1] not in self.CHARACTER_FEATURE_COLOUR_TARGETS:
            return None
        if not any(word in self.CHARACTER_COLOUR_WORDS for word in words):
            return None
        return words[-1]

    def _collapse_character_feature_colours(self, value, rng):
        parts = self._dedupe_prompt_tokens(value)
        groups = {}
        for tag in parts:
            group = self._character_feature_colour_group(tag)
            if group:
                groups.setdefault(group, []).append(tag)

        chosen = {}
        for group, tags in groups.items():
            chosen[group] = rng.choice(tags) if rng is not None and len(tags) > 1 else tags[0]

        collapsed = []
        emitted = set()
        for tag in parts:
            group = self._character_feature_colour_group(tag)
            if not group:
                collapsed.append(tag)
                continue
            if group in emitted:
                continue
            emitted.add(group)
            collapsed.append(chosen[group])
        return collapsed

    def _sample_parts(self, value, count, rng):
        unique = self._dedupe_prompt_tokens(value)
        count = max(0, self._int_value(count, 0))
        if count <= 0 or not unique or rng is None:
            return []
        if count >= len(unique):
            return unique
        return rng.sample(unique, count)

    def _artist_entry(self, item):
        name = str(item.get("name") or "").strip()
        if not name:
            return None
        item_id = item.get("id") or ""
        partition = item.get("p") or 1
        preview_name = re.sub(r"\\([()[\]{}])", r"\1", name).strip()
        return {
            "section": "artist",
            "key": f"artist:{item_id or name}",
            "title": name,
            "subtitle": f"{item.get('post_count', 0)} works" if item.get("post_count") else "",
            "preview": f"https://blobs.animadex.net/ArtistOutputs/thumbs/{urllib.parse.quote(preview_name, safe='')}.webp",
            "preview_id": str(item_id),
            "preview_partition": str(partition),
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
        tags = self._dedupe_prompt_tokens(tags)
        feature_parts, outfit_parts = self._split_character_tags(tags)
        raw_name = f"{name}, {copyright}" if copyright else name
        return {
            "section": "character",
            "key": f"character:{name}||{copyright}",
            "title": name,
            "subtitle": copyright,
            "preview": f"https://blobs.animadex.net/Outputs/thumbs/{urllib.parse.quote(raw_name, safe='')}.webp",
            "trigger_parts": self._split_prompt_tokens(trigger),
            "tag_parts": tags,
            "feature_parts": feature_parts,
            "outfit_parts": outfit_parts,
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

    @classmethod
    def _load_danbooru_pools(cls):
        """Danbooru attire tag pools bundled with the node, keyed by slot."""
        data = cls._load_json_object(cls.DANBOORU_ATTIRE_FILE)
        pools = {}
        for slot in cls.DANBOORU_SLOT_ORDER:
            tags = data.get(slot)
            pools[slot] = [tag.strip() for tag in tags if isinstance(tag, str) and tag.strip()] if isinstance(tags, list) else []
        return pools

    @classmethod
    def _load_danbooru_vocabulary(cls):
        """Every Danbooru attire tag, used as a wearable-tag whitelist."""
        data = cls._load_json_object(cls.DANBOORU_ATTIRE_FILE)
        words = data.get(cls.DANBOORU_VOCABULARY_KEY)
        if not isinstance(words, list):
            return set()
        return {word.strip().lower() for word in words if isinstance(word, str) and word.strip()}

    def _danbooru_clothing_entry(self, slot, tag):
        return {
            "section": "clothing",
            "key": f"clothing:danbooru:{slot}:{tag}",
            "title": tag,
            "subtitle": f"danbooru {slot}",
            "preview": "",
            "prompt_parts": [tag],
        }

    def _danbooru_clothing_entries(self, rng):
        """Build one outfit from the Danbooru tag groups.

        Exactly one main outfit is drawn - a random top paired with a random
        bottom, a uniform or a traditional garment - so the categories can never
        contradict each other.  Decoration, legwear and footwear are layered on
        top afterwards.
        """
        pools = self._load_danbooru_pools()
        if not pools.get("top") or not pools.get("bottom") or not pools.get("uniform") or not pools.get("traditional"):
            return []

        entries = []
        variant = rng.choice(self.DANBOORU_MAIN_VARIANTS)
        if variant == "top_bottom":
            entries.append(self._danbooru_clothing_entry("top", rng.choice(pools["top"])))
            entries.append(self._danbooru_clothing_entry("bottom", rng.choice(pools["bottom"])))
        else:
            entries.append(self._danbooru_clothing_entry(variant, rng.choice(pools[variant])))

        for slot, probability in self.DANBOORU_LAYERED_SLOTS:
            pool = pools.get(slot) or []
            if not pool:
                continue
            if probability < 1 and rng.random() >= probability:
                continue
            entries.append(self._danbooru_clothing_entry(slot, rng.choice(pool)))
        return entries

    def _character_tag_clothing_entries(self, character_data, official_data, rng, attempts=40):
        """Reuse another character's official tags as the outfit.

        The trigger, gender words and eyes/hair words are left out, and what is
        left is intersected with the Danbooru attire vocabulary so that body or
        pose tags (``beard``, ``large breasts``, ...) never end up as clothing.
        Only about a fifth of the roster carries two or more wearable tags, so the
        draw is retried a few dozen times before giving up.
        """
        vocabulary = self._load_danbooru_vocabulary()
        for _ in range(max(1, self._int_value(attempts, 1))):
            items = self._pick_items(character_data, 1, rng)
            if not items:
                return []
            entry = self._character_entry(items[0], official_data)
            if not entry:
                continue
            outfit_parts = self._dedupe_prompt_tokens(entry.get("outfit_parts"))
            if vocabulary:
                outfit_parts = [tag for tag in outfit_parts if tag.lower() in vocabulary]
            if len(outfit_parts) < 2:
                continue
            return [
                {
                    "section": "clothing",
                    "key": f"clothing:character_tags:{entry['key']}",
                    "title": entry["title"],
                    "subtitle": entry.get("subtitle") or "",
                    "preview": entry.get("preview") or "",
                    "prompt_parts": outfit_parts,
                }
            ]
        return []

    def _resolve_clothing_entries(self, clothing_data, character_data, official_data, clothing_source, rng):
        source = str(clothing_source or "")
        if source not in self.CLOTHING_SOURCES:
            source = self.CLOTHING_SOURCES[0]
        if source == "random":
            source = rng.choice(tuple(name for name in self.CLOTHING_SOURCES if name != "random"))

        if source == "danbooru":
            entries = self._danbooru_clothing_entries(rng)
            if entries:
                return entries

        if source == "character_tags":
            entries = self._character_tag_clothing_entries(character_data, official_data, rng)
            if entries:
                return entries

        return [entry for entry in (self._clothing_entry(item) for item in self._pick_items(clothing_data, 1, rng)) if entry]

    def _entry_parts(self, entry, section, character_detail, rng=None, character_options=None):
        if section != "character":
            return self._split_prompt_tokens(entry.get("prompt_parts"))

        parts = self._split_prompt_tokens(entry.get("trigger_parts"))
        if character_detail == "trigger_tags":
            parts.extend(self._split_prompt_tokens(entry.get("tag_parts")))
        elif character_detail == "trigger_random_tags":
            options = character_options or {}
            # Eyes/hair words ride along with the trigger so the character keeps
            # looking like itself, while the remaining tags are reshuffled to
            # multiply the reachable combinations.
            if self._truthy(options.get("keep_features"), True):
                parts.extend(self._collapse_character_feature_colours(entry.get("feature_parts"), rng))
            parts.extend(self._sample_parts(entry.get("outfit_parts"), options.get("tag_count", 0), rng))
        return parts

    def _append_parts(self, output_parts, seen, entries, section, character_detail, rng=None, character_options=None):
        for entry in entries:
            for part in self._entry_parts(entry, section, character_detail, rng, character_options):
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
            "character_seed",
            "character_tag_count",
            "character_keep_features",
            "clothing_seed",
            "clothing_source",
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
        enable_artist=True,
        enable_character=True,
        enable_clothing=True,
        enable_background=True,
        enable_pose=True,
        character_detail="trigger",
        seed=-1,
        artist_count=1,
        character_seed=-1,
        character_tag_count=3,
        character_keep_features=True,
        clothing_seed=-1,
        clothing_source="author",
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
        character_rng = self._section_rng(character_seed, rng)
        clothing_rng = self._section_rng(clothing_seed, rng)

        # Draw order stays artist -> character -> clothing -> background -> pose so
        # that existing fixed seeds keep producing the exact same prompt.
        artist_items = self._pick_items(artist_data, self._int_value(artist_count, 1), rng) if self._truthy(enable_artist, True) else []
        character_items = self._pick_items(character_data, 1, character_rng) if self._truthy(enable_character, True) else []
        character_entries = [entry for entry in (self._character_entry(item, official_data) for item in character_items) if entry]
        if self._truthy(enable_clothing, True):
            clothing_entries = self._resolve_clothing_entries(
                clothing_data, character_data, official_data, clothing_source, clothing_rng
            )
        else:
            clothing_entries = []
        background_items = self._pick_items(background_data, 1, rng) if self._truthy(enable_background, True) else []
        pose_items = self._pick_items(pose_data, 1, rng) if self._truthy(enable_pose, True) else []

        selected = {
            "artist": [entry for entry in (self._artist_entry(item) for item in artist_items) if entry],
            "character": character_entries,
            "clothing": clothing_entries,
            "background": [entry for entry in (self._background_entry(item) for item in background_items) if entry],
            "pose": [entry for entry in (self._pose_entry(item) for item in pose_items) if entry],
        }

        output_parts = []
        seen = set()
        character_options = {
            "tag_count": self._int_value(character_tag_count, 0),
            "keep_features": self._truthy(character_keep_features, True),
        }
        self._append_parts(output_parts, seen, selected["artist"], "artist", character_detail, rng)
        self._append_parts(
            output_parts, seen, selected["character"], "character", character_detail, character_rng, character_options
        )
        self._append_parts(output_parts, seen, selected["clothing"], "clothing", character_detail, rng)
        self._append_parts(output_parts, seen, selected["background"], "background", character_detail, rng)
        self._append_parts(output_parts, seen, selected["pose"], "pose", character_detail, rng)

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
        character_seed=-1,
        character_tag_count=3,
        character_keep_features=True,
        clothing_seed=-1,
        clothing_source="author",
    ):
        seed_value = self._int_value(seed, -1)
        text = self._extract_resolved_prompt_text(resolved_prompt)

        resolve_kwargs = {
            "enable_artist": enable_artist,
            "enable_character": enable_character,
            "enable_clothing": enable_clothing,
            "enable_background": enable_background,
            "enable_pose": enable_pose,
            "character_detail": character_detail,
            "artist_count": artist_count,
            "character_seed": character_seed,
            "character_tag_count": character_tag_count,
            "character_keep_features": character_keep_features,
            "clothing_seed": clothing_seed,
            "clothing_source": clothing_source,
        }

        # resolved_prompt is persisted in the workflow so the UI can show the
        # exact result chosen for seed=-1.  It must not override a fixed seed:
        # in particular, a seed supplied through a link cannot be resolved by
        # the pre-queue hook and the persisted text may belong to another run.
        if seed_value >= 0:
            selected, text = self._resolve_prompt_data(seed=seed_value, **resolve_kwargs)
        elif text:
            selected = (
                self._selection_from_workflow(extra_pnginfo, unique_id, text)
                or self._normalize_selected(self._parse_selection_payload(resolved_prompt), text)
            )
        else:
            selected, text = self._resolve_prompt_data(seed=seed, **resolve_kwargs)
        selected["_resolved_prompt"] = text
        self._record_resolved_prompt(prompt, extra_pnginfo, unique_id, text, selected)

        return {"ui": {"anima_prompt_composer": [selected], "resolved_prompt": [text]}, "result": (text,)}

from .lora_manager.nodes import AnimaMultiLoraLoader

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
    "AnimaPromptPlusClipEncode": AnimaPromptPlusClipEncode,
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
    "AnimaPromptPlus": "Anima Prompt",
    "AnimaPromptPlusClipEncode": "Anima Prompt Plus",
    "AnimaPromptComposer": "Anima Prompt Random Draw",
    "AnimaMultiLoraLoader": "Anima Multi LoRA Loader"
}

# ----------------- 后端持久化 API 路由 -----------------
import folder_paths
from server import PromptServer
from aiohttp import ClientSession, ClientTimeout, web
import json
import os
import hashlib
import re
import threading
import time
import urllib.parse
import urllib.request

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
    "AnimaPromptPlusClipEncode": {
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
    "AnimaPromptPlusClipEncode": [
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

def _resolve_anima_prompt_plus_clip_nodes(prompt, extra_pnginfo, prompt_plus):
    updates = {}
    for node_id, node in list(prompt.items()):
        if not isinstance(node, dict) or node.get("class_type") != "AnimaPromptPlusClipEncode":
            continue
        inputs = node.setdefault("inputs", {})
        if not isinstance(inputs, dict):
            continue

        resolved_text = prompt_plus._compose_prompt_text(
            inputs.get("quality_prompt", ""),
            inputs.get("artist_tags", ""),
            inputs.get("character_tags", ""),
            inputs.get("clothing_tags", ""),
            inputs.get("pose_tags", ""),
            inputs.get("background_tags", ""),
            inputs.get("extra_prompt", ""),
            inputs.get("separator", ", "),
        )
        inputs["text"] = resolved_text

        if isinstance(extra_pnginfo, dict):
            records = extra_pnginfo.setdefault("anima_prompt", {})
            if not isinstance(records, dict):
                records = {}
                extra_pnginfo["anima_prompt"] = records
            records[str(node_id)] = {"positive": resolved_text}

        updates[str(node_id)] = {
            "quality_prompt": inputs.get("quality_prompt", ""),
            "artist_tags": inputs.get("artist_tags", ""),
            "character_tags": inputs.get("character_tags", ""),
            "clothing_tags": inputs.get("clothing_tags", ""),
            "pose_tags": inputs.get("pose_tags", ""),
            "background_tags": inputs.get("background_tags", ""),
            "extra_prompt": inputs.get("extra_prompt", ""),
            "separator": inputs.get("separator", ", "),
        }
    return updates

def _resolve_anima_prompt_composer_nodes(prompt, extra_pnginfo, composer):
    """Draw the random prompt of every ``AnimaPromptComposer`` before the queue.

    Resolving here is what keeps the ``resolved_prompt`` widget, the node preview
    and the prompt that finally runs in sync while ``seed`` is ``-1``, because
    ``compose_prompt`` reuses the text this hook stored.

    That only holds while every relevant input already has a value.  A linked
    input is still ``[node_id, output_index]`` at this point, so resolving anyway
    would persist a prompt built from the widget defaults - a fixed
    ``character_seed`` of 4242 would be read as ``-1`` and the character would
    keep changing - and ``compose_prompt`` would then reuse that stale text
    instead of the value that was evaluated.  Such nodes are deferred to
    execution, and any text persisted by an earlier run is dropped so that it
    cannot be reused either.
    """
    if not isinstance(prompt, dict):
        return

    for node_id, node in list(prompt.items()):
        if not isinstance(node, dict) or node.get("class_type") != "AnimaPromptComposer":
            continue
        inputs = node.setdefault("inputs", {})
        if not isinstance(inputs, dict):
            continue

        if any(isinstance(inputs.get(name), list) for name in composer.QUEUE_RESOLVE_INPUTS):
            inputs["resolved_prompt"] = ""
            continue

        selected, resolved_prompt = composer._resolve_prompt_data(
            enable_artist=inputs.get("enable_artist", True),
            enable_character=inputs.get("enable_character", True),
            enable_clothing=inputs.get("enable_clothing", True),
            enable_background=inputs.get("enable_background", True),
            enable_pose=inputs.get("enable_pose", True),
            character_detail=inputs.get("character_detail", "trigger"),
            seed=inputs.get("seed", -1),
            artist_count=inputs.get("artist_count", 1),
            character_seed=inputs.get("character_seed", -1),
            character_tag_count=inputs.get("character_tag_count", 3),
            character_keep_features=inputs.get("character_keep_features", True),
            clothing_seed=inputs.get("clothing_seed", -1),
            clothing_source=inputs.get("clothing_source", "author"),
        )
        inputs["resolved_prompt"] = resolved_prompt
        composer._record_resolved_prompt(
            prompt,
            extra_pnginfo,
            node_id,
            resolved_prompt,
            selected,
        )

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
            prompt_plus_updates = _resolve_anima_prompt_plus_clip_nodes(
                prompt,
                extra_pnginfo,
                AnimaPromptPlus(),
            )
            if prompt_plus_updates:
                PromptServer.instance.send_sync(
                    "anima.prompt_plus_resolved",
                    {"nodes": prompt_plus_updates},
                    json_data.get("client_id"),
                )

            _resolve_anima_prompt_composer_nodes(prompt, extra_pnginfo, composer)
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
            "groups": [{"id": "default", "name": "Default Favorites", "isSystem": True}],
            "items": []
        },
        "character": {
            "groups": [{"id": "default", "name": "Default Favorites", "isSystem": True}],
            "items": []
        },
        "lora": {
            "groups": [{"id": "default", "name": "Default Favorites", "isSystem": True}],
            "items": []
        },
        "clothing": {
            "groups": [{"id": "default", "name": "Default Favorites", "isSystem": True}],
            "items": []
        },
        "background": {
            "groups": [{"id": "default", "name": "Default Favorites", "isSystem": True}],
            "items": []
        },
        "pose": {
            "groups": [{"id": "default", "name": "Default Favorites", "isSystem": True}],
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
        for group in groups:
            if isinstance(group, dict) and group.get("id") == "default" and group.get("isSystem", True):
                group["name"] = "Default Favorites"
                group["isSystem"] = True
        items = section.get("items")
        if not isinstance(items, list):
            items = []
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
ANIMADEX_CHARACTER_THUMB_BASE = "https://blobs.animadex.net/Outputs/thumbs"
ANIMADEX_ARTIST_THUMB_BASE = "https://blobs.animadex.net/ArtistOutputs/thumbs"
ANIMA_ASSETS_BASES = (
    "https://fastly.jsdelivr.net/gh/ThetaCursed/Anima-Assets@main/images",
    "https://raw.githubusercontent.com/ThetaCursed/Anima-Assets/main/images",
)
SAFEBOORU_POSTS_API = "https://safebooru.org/index.php"
ANIMADEX_PREVIEW_MAX_BYTES = 8 * 1024 * 1024
_animadex_character_cache = {}
_animadex_character_cache_lock = threading.Lock()
_animadex_character_cache_ttl = 60 * 60 * 12

def _normalize_animadex_text(value: str) -> str:
    return " ".join(str(value or "").strip().lower().replace("_", " ").split())

def _animadex_character_cache_key(name: str, copyright: str) -> str:
    return f"{_normalize_animadex_text(name)}||{_normalize_animadex_text(copyright)}"

def _animadex_character_preview_url(name: str, copyright: str) -> str:
    raw_name = f"{name}, {copyright}" if copyright else name
    encoded_name = urllib.parse.quote(raw_name, safe="")
    return f"{ANIMADEX_CHARACTER_THUMB_BASE}/{encoded_name}.webp"

def _normalize_animadex_artist_preview_name(name: str) -> str:
    return re.sub(r"\\([()[\]{}])", r"\1", str(name or "")).strip()

def _animadex_artist_preview_url(name: str) -> str:
    encoded_name = urllib.parse.quote(_normalize_animadex_artist_preview_name(name), safe="")
    return f"{ANIMADEX_ARTIST_THUMB_BASE}/{encoded_name}.webp"

def _artist_preview_candidates(name: str, item_id: str = "", partition: str = "") -> list[str]:
    candidates = [_animadex_artist_preview_url(name)]
    item_id = str(item_id or "").strip()
    partition = str(partition or "").strip()
    if item_id.isdigit() and partition.isdigit():
        candidates.extend(f"{base}/{partition}/{item_id}.webp" for base in ANIMA_ASSETS_BASES)
    return candidates

def _safebooru_artist_tag(name: str) -> str:
    return _normalize_animadex_artist_preview_name(name).replace(" ", "_")

def _safebooru_artist_search_url(name: str) -> str:
    params = urllib.parse.urlencode({
        "page": "dapi",
        "s": "post",
        "q": "index",
        "json": "1",
        "tags": _safebooru_artist_tag(name),
        "limit": "1",
    })
    return f"{SAFEBOORU_POSTS_API}?{params}"

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

async def _read_remote_preview(session, source_url: str):
    try:
        async with session.get(source_url, allow_redirects=False) as upstream:
            if upstream.status != 200:
                return None
            content_type = str(upstream.headers.get("Content-Type", "")).split(";", 1)[0].strip().lower()
            if not content_type.startswith("image/"):
                return None
            image_data = bytearray()
            async for chunk in upstream.content.iter_chunked(64 * 1024):
                image_data.extend(chunk)
                if len(image_data) > ANIMADEX_PREVIEW_MAX_BYTES:
                    return None
            if not image_data:
                return None
            return bytes(image_data), content_type
    except Exception:
        return None

async def _resolve_safebooru_artist_preview(session, artist_name: str) -> str:
    try:
        async with session.get(_safebooru_artist_search_url(artist_name), allow_redirects=False) as upstream:
            if upstream.status != 200:
                return ""
            data = await upstream.json(content_type=None)
        if not isinstance(data, list) or not data or not isinstance(data[0], dict):
            return ""
        preview_url = str(data[0].get("preview_url") or "").strip()
        parsed = urllib.parse.urlparse(preview_url)
        if parsed.scheme != "https" or parsed.hostname not in {"safebooru.org", "www.safebooru.org"}:
            return ""
        return preview_url
    except Exception:
        return ""

async def _proxy_remote_previews(source_urls: list[str], preview_kind: str, artist_name: str = ""):
    try:
        timeout = ClientTimeout(total=15)
        headers = {
            "User-Agent": "ComfyUI-Anima-Tools/1.0 (+https://github.com/nregret/Comfyui-Anima-Tools)",
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        }
        async with ClientSession(timeout=timeout, headers=headers) as session:
            for source_url in source_urls:
                preview = await _read_remote_preview(session, source_url)
                if preview:
                    image_data, content_type = preview
                    break
            else:
                fallback_url = await _resolve_safebooru_artist_preview(session, artist_name) if artist_name else ""
                preview = await _read_remote_preview(session, fallback_url) if fallback_url else None
                if not preview:
                    return web.Response(status=404)
                image_data, content_type = preview
        return web.Response(
            body=image_data,
            content_type=content_type,
            headers={"Cache-Control": "public, max-age=604800, immutable"},
        )
    except Exception as e:
        print(f"[Anima Tools] Error proxying AnimaDex {preview_kind} preview: {e}")
        return web.Response(status=502)

@PromptServer.instance.routes.get("/anima-tools/character/preview")
async def get_character_preview_api(request):
    name = str(request.query.get("name", "")).strip()
    copyright = str(request.query.get("copyright", "")).strip()
    if not name:
        return web.Response(status=400)
    if len(name) > 160 or len(copyright) > 160:
        return web.Response(status=400)
    return await _proxy_remote_previews(
        [_animadex_character_preview_url(name, copyright)],
        "character",
    )

@PromptServer.instance.routes.get("/anima-tools/artist/preview")
async def get_artist_preview_api(request):
    name = str(request.query.get("name", "")).strip()
    item_id = str(request.query.get("id", "")).strip()
    partition = str(request.query.get("partition", "")).strip()
    if not name or len(name) > 160:
        return web.Response(status=400)
    if len(item_id) > 32 or len(partition) > 16:
        return web.Response(status=400)
    return await _proxy_remote_previews(
        _artist_preview_candidates(name, item_id, partition),
        "artist",
        artist_name=name,
    )
