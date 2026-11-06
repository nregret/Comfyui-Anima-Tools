import assert from "node:assert/strict";

import { getEntryPreviewUrl } from "../js/anima_prompt_composer_preview.js";

assert.equal(
    getEntryPreviewUrl({
        section: "character",
        title: "hatsune miku",
        subtitle: "vocaloid",
        preview: "https://blobs.animadex.net/Outputs/thumbs/hatsune%20miku%2C%20vocaloid.webp",
    }),
    "/anima-tools/character/preview?name=hatsune+miku&copyright=vocaloid",
);

assert.equal(
    getEntryPreviewUrl({
        section: "character",
        title: "mejiro mcqueen (umamusume)",
        subtitle: "umamusume",
    }),
    "/anima-tools/character/preview?name=mejiro+mcqueen+%28umamusume%29&copyright=umamusume",
);

assert.equal(
    getEntryPreviewUrl({
        section: "artist",
        title: "dairi",
        preview: "https://cdn.jsdelivr.net/gh/nregret/AnimaTags-DB@main/images/artist/dairi-1cf6814da2-p1.webp",
    }),
    "https://cdn.jsdelivr.net/gh/nregret/AnimaTags-DB@main/images/artist/dairi-1cf6814da2-p1.webp",
);

assert.equal(
    getEntryPreviewUrl({
        section: "clothing",
        title: "example",
        preview: "https://cdn.example/example.webp",
    }),
    "https://cdn.example/example.webp",
);

console.log("anima_prompt_composer_preview tests passed");
