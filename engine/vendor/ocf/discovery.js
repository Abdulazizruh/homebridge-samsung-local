"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStubRep = isStubRep;
exports.parseDevice0Batch = parseDevice0Batch;
exports.deviceTypesFrom = deviceTypesFrom;
function isStubRep(rep) {
    return !!rep && typeof rep === "object" && Object.keys(rep).length === 1 && "href" in rep;
}
/** Parse a /device/0 batch list into {href: rep}, dropping stub placeholders. */
function parseDevice0Batch(device0) {
    const out = {};
    for (const item of device0) {
        if (item && typeof item === "object" && "href" in item) {
            const href = item.href;
            const rep = item.rep;
            if (rep && typeof rep === "object" && !isStubRep({ ...rep, href })) {
                out[href] = rep;
            }
            else if (rep && typeof rep === "object") {
                out[href] = rep;
            }
        }
    }
    return out;
}
/** Device types (oic.d.*) and platform identity extracted from /oic/d + /oic/res. */
function deviceTypesFrom(oicD, oicRes) {
    const types = new Set();
    const rt = oicD?.["rt"] ?? [];
    for (const t of rt)
        types.add(t);
    // /oic/res device-collection link also advertises the device types
    for (const l of oicRes ?? []) {
        if (l.href === "/oic/d" || (l.rt ?? []).some((t) => t.startsWith("oic.d.") || t === "oic.wk.d")) {
            for (const t of l.rt ?? [])
                types.add(t);
        }
    }
    return [...types];
}
