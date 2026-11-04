// ─── India locations (server only) ────────────────────────────
// State/UT → District → City / Taluka → Locality → PIN, from the India Post directory
// (src/lib/geo/india-locations.json, built by scripts/geo/build-india-locations.ts),
// plus localities recruiters typed in themselves (customLocalities collection).
//
// IDs are stable strings, so stored records survive a dataset rebuild:
//   state "MH" · district "MH:pune" · city "MH:pune:mulshi"

import fs from "node:fs";
import path from "node:path";
import { customLocalities } from "@/lib/mock/data";

export interface GeoState { code: string; name: string; type: "STATE" | "UT" }
export interface GeoDistrict { id: string; stateCode: string; name: string }
export interface GeoCity { id: string; districtId: string; name: string }
export interface GeoLocality { name: string; pincode: string; cityId: string; custom?: boolean }
export interface GeoPlace { locality: string; pincode: string; city: GeoCity; district: GeoDistrict; state: GeoState; custom?: boolean }

interface Raw { states: [string, string, boolean][]; districts: [number, string][]; cities: [number, string][]; localities: [number, string, string][] }

export const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

interface Index {
    states: GeoState[];
    stateByCode: Map<string, GeoState>;
    districts: GeoDistrict[];
    districtById: Map<string, GeoDistrict>;
    districtsByState: Map<string, GeoDistrict[]>;
    cities: GeoCity[];
    cityById: Map<string, GeoCity>;
    citiesByDistrict: Map<string, GeoCity[]>;
    localities: GeoLocality[];
    localitiesByCity: Map<string, GeoLocality[]>;
    byPin: Map<string, GeoLocality[]>;
    searchKeys: string[]; // normalised locality names, same order as localities
}

let cache: Index | null = null;

function load(): Index {
    if (cache) return cache;
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/lib/geo/india-locations.json"), "utf8")) as Raw;
    const states: GeoState[] = raw.states.map(([code, name, ut]) => ({ code, name, type: ut ? "UT" : "STATE" }));
    const districts: GeoDistrict[] = raw.districts.map(([s, name]) => ({ id: `${states[s].code}:${slug(name)}`, stateCode: states[s].code, name }));
    const cities: GeoCity[] = raw.cities.map(([d, name]) => ({ id: `${districts[d].id}:${slug(name)}`, districtId: districts[d].id, name }));
    const localities: GeoLocality[] = raw.localities.map(([c, name, pincode]) => ({ name, pincode, cityId: cities[c].id }));

    const group = <T, K>(xs: T[], k: (x: T) => K) => {
        const m = new Map<K, T[]>();
        for (const x of xs) { const key = k(x); const list = m.get(key); if (list) list.push(x); else m.set(key, [x]); }
        return m;
    };
    cache = {
        states,
        stateByCode: new Map(states.map((s) => [s.code, s])),
        districts,
        districtById: new Map(districts.map((d) => [d.id, d])),
        districtsByState: group(districts, (d) => d.stateCode),
        cities,
        cityById: new Map(cities.map((c) => [c.id, c])),
        citiesByDistrict: group(cities, (c) => c.districtId),
        localities,
        localitiesByCity: group(localities, (l) => l.cityId),
        byPin: group(localities, (l) => l.pincode),
        searchKeys: localities.map((l) => norm(l.name)),
    };
    return cache;
}

const customFor = (orgId: string) => customLocalities.filter((c) => c.orgId === orgId).map((c): GeoLocality => ({ name: c.name, pincode: c.pincode, cityId: c.cityId, custom: true }));

export function geoStates(): GeoState[] {
    // States first, then UTs, each alphabetically
    return [...load().states].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "STATE" ? -1 : 1));
}
export const geoState = (code: string | null | undefined) => (code ? load().stateByCode.get(code) ?? null : null);
export const geoDistricts = (stateCode: string) => load().districtsByState.get(stateCode) ?? [];
export const geoDistrict = (id: string | null | undefined) => (id ? load().districtById.get(id) ?? null : null);
export const geoCities = (districtId: string) => load().citiesByDistrict.get(districtId) ?? [];
export const geoCity = (id: string | null | undefined) => (id ? load().cityById.get(id) ?? null : null);

function place(l: GeoLocality): GeoPlace | null {
    const idx = load();
    const city = idx.cityById.get(l.cityId);
    const district = city ? idx.districtById.get(city.districtId) : undefined;
    const state = district ? idx.stateByCode.get(district.stateCode) : undefined;
    return city && district && state ? { locality: l.name, pincode: l.pincode, city, district, state, custom: l.custom } : null;
}

/** Localities in a city (or anywhere in a district), optionally filtered by name / PIN; custom entries included. */
export function geoLocalities(orgId: string, opts: { cityId?: string; districtId?: string; q?: string; limit?: number }): GeoPlace[] {
    const idx = load();
    const cityIds = opts.cityId ? [opts.cityId] : opts.districtId ? (idx.citiesByDistrict.get(opts.districtId) ?? []).map((c) => c.id) : [];
    const ids = new Set(cityIds);
    const pool = [...cityIds.flatMap((id) => idx.localitiesByCity.get(id) ?? []), ...customFor(orgId).filter((c) => ids.has(c.cityId))];
    return rank(pool, opts.q ?? "", opts.limit ?? 50);
}

/** India-wide quick search by locality name or PIN (e.g. "hinjawadi", "411057"). */
export function geoSearch(orgId: string, q: string, limit = 20): GeoPlace[] {
    const idx = load();
    const t = q.trim();
    if (/^\d{3,6}$/.test(t)) {
        const pool = t.length === 6 ? idx.byPin.get(t) ?? [] : idx.localities.filter((l) => l.pincode.startsWith(t));
        return [...pool, ...customFor(orgId).filter((c) => c.pincode.startsWith(t))].slice(0, limit).map(place).filter((p): p is GeoPlace => !!p);
    }
    const n = norm(t);
    if (n.length < 3) return [];
    const hits: GeoLocality[] = [];
    for (let i = 0; i < idx.localities.length && hits.length < 400; i++) if (idx.searchKeys[i].includes(n)) hits.push(idx.localities[i]);
    return rank([...hits, ...customFor(orgId).filter((c) => norm(c.name).includes(n))], t, limit);
}

function rank(pool: GeoLocality[], q: string, limit: number): GeoPlace[] {
    const n = norm(q);
    const scored = pool
        .map((l) => {
            const k = norm(l.name);
            const s = !n ? 0 : l.pincode === q.trim() ? 0 : k === n ? 1 : k.startsWith(n) ? 2 : k.includes(n) ? 3 : l.pincode.startsWith(q.trim()) ? 4 : 9;
            return { l, s };
        })
        .filter((x) => x.s < 9)
        .sort((a, b) => a.s - b.s || a.l.name.length - b.l.name.length || a.l.name.localeCompare(b.l.name));
    const seen = new Set<string>();
    const out: GeoPlace[] = [];
    for (const { l } of scored) {
        const key = `${l.cityId}|${norm(l.name)}|${l.pincode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const p = place(l);
        if (p) out.push(p);
        if (out.length >= limit) break;
    }
    return out;
}

/** Where a PIN code is, per the India Post directory. */
export function geoPin(orgId: string, pin: string) {
    const list = [...(load().byPin.get(pin) ?? []), ...customFor(orgId).filter((c) => c.pincode === pin)];
    const places = list.map(place).filter((p): p is GeoPlace => !!p);
    return {
        pincode: pin,
        known: places.some((p) => !p.custom),
        districts: [...new Map(places.map((p) => [p.district.id, { id: p.district.id, name: p.district.name, stateCode: p.state.code, stateName: p.state.name }])).values()],
        localities: places.slice(0, 60),
    };
}

export const isPincode = (s: string) => /^[1-9]\d{5}$/.test(s);

export type WorkModeValue = "ONSITE" | "HYBRID" | "REMOTE" | "WFH" | "FIELD";

export interface LocationInput {
    workMode: WorkModeValue;
    stateCode?: string | null;
    districtId?: string | null;
    cityId?: string | null;
    locality?: string | null;
    pincode?: string | null;
    officeAddress?: { building?: string | null; floor?: string | null; street?: string | null; landmark?: string | null } | null;
}

export interface ResolvedLocation {
    stateCode: string | null; stateName: string | null;
    districtId: string | null; districtName: string | null;
    cityId: string | null; cityName: string | null;
    locality: string | null; pincode: string | null;
    localityIsCustom: boolean;
    summary: string; // "Locality, City, District, State – PIN"
}

/**
 * Checks the hierarchy (state ⊃ district ⊃ city), the PIN format and how well the PIN matches,
 * and which parts the work mode requires. Never changes what the user picked: mismatches are warnings.
 */
export function validateLocation(orgId: string, input: LocationInput): { errors: string[]; warnings: string[]; location: ResolvedLocation } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const state = geoState(input.stateCode);
    const district = geoDistrict(input.districtId);
    const city = geoCity(input.cityId);
    const locality = String(input.locality ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null;
    const pincode = String(input.pincode ?? "").replace(/\s/g, "") || null;
    const mode = input.workMode;

    // What each work mode needs
    const needsPlace = mode === "ONSITE" || mode === "HYBRID" || mode === "FIELD";
    const needsArea = mode !== "REMOTE"; // state / district / city
    if (input.stateCode && !state) errors.push("Select a valid State / UT");
    if (input.districtId && !district) errors.push("Select a valid district");
    if (input.cityId && !city) errors.push("Select a valid city / taluka");
    if (state && district && district.stateCode !== state.code) errors.push(`${district.name} is not in ${state.name}`);
    if (district && city && city.districtId !== district.id) errors.push(`${city.name} is not in ${district.name} district`);
    if (needsArea) {
        if (!input.stateCode) errors.push("State / UT is required");
        if (!input.districtId) errors.push("District is required");
        if (!input.cityId) errors.push("City / taluka is required");
    }
    if (needsPlace) {
        if (!locality) errors.push("Locality / area is required for office-based work");
        if (!pincode) errors.push("PIN code is required for office-based work");
    }
    if (mode === "ONSITE") {
        const a = input.officeAddress ?? {};
        if (!String(a.building ?? "").trim() && !String(a.street ?? "").trim()) errors.push("Office address (building or street) is required for Work From Office");
    }
    if (pincode && !isPincode(pincode)) errors.push("PIN code must be exactly 6 digits (and cannot start with 0)");

    let localityIsCustom = false;
    if (pincode && isPincode(pincode)) {
        const info = geoPin(orgId, pincode);
        if (!info.known) warnings.push(`PIN ${pincode} is not in the India Post directory — please double-check it`);
        else if (district && !info.districts.some((d) => d.id === district.id)) {
            const where = info.districts.map((d) => `${d.name}, ${d.stateName}`).join(" / ");
            warnings.push(`PIN ${pincode} belongs to ${where}, not ${district.name}`);
        }
    }
    if (locality && city) {
        const inCity = (load().localitiesByCity.get(city.id) ?? []).some((l) => norm(l.name) === norm(locality));
        localityIsCustom = !inCity;
    }

    const parts = [locality, city?.name, district && district.name !== city?.name ? district.name : null, state?.name].filter(Boolean);
    return {
        errors, warnings,
        location: {
            stateCode: state?.code ?? null, stateName: state?.name ?? null,
            districtId: district?.id ?? null, districtName: district?.name ?? null,
            cityId: city?.id ?? null, cityName: city?.name ?? null,
            locality, pincode, localityIsCustom,
            summary: parts.join(", ") + (pincode ? ` – ${pincode}` : ""),
        },
    };
}

/** Remember a locality the recruiter typed in (once per city + name + PIN), so it is suggested next time. */
export function rememberLocality(orgId: string, userId: string, loc: ResolvedLocation) {
    if (!loc.localityIsCustom || !loc.locality || !loc.cityId || !loc.pincode || !isPincode(loc.pincode)) return;
    const k = norm(loc.locality);
    if (customLocalities.some((c) => c.orgId === orgId && c.cityId === loc.cityId && c.pincode === loc.pincode && norm(c.name) === k)) return;
    customLocalities.push({
        id: `loc-${crypto.randomUUID().slice(0, 8)}`, orgId, stateCode: loc.stateCode!, districtId: loc.districtId!, cityId: loc.cityId,
        name: loc.locality, pincode: loc.pincode, createdById: userId, createdAt: new Date().toISOString(),
    });
}
