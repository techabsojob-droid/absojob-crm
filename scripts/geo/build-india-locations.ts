// ─── Build the India location dataset ─────────────────────────
// One-off generator for src/lib/geo/india-locations.json from India Post data.
//
//   npx tsx scripts/geo/build-india-locations.ts <post-offices.json> <pincode-taluks.json>
//
//   post-offices.json   India Post all-India PIN directory, one row per post office
//                       { name, pincode, district, state, ... }  (npm "indian-pincodes" data/pincodes.json)
//   pincode-taluks.json one row per PIN with its sub-district / taluka
//                       { pincode, district: <taluka>, city: <district>, state, ... } (npm "india-pincode-search" db/pincode_db.json)
//
// Output hierarchy: State/UT → District → City / Taluka → Locality (post office) → PIN.
// Names are cleaned, states are mapped to the current 28 states + 8 UTs (Ladakh split out of J&K,
// Dadra & Nagar Haveli and Daman & Diu merged), and renamed districts get their current names.

import fs from "node:fs";
import path from "node:path";

type Office = { name: string; pincode: number | string; district: string; state: string };
type Taluk = { pincode?: number | string; district?: string; city?: string; state?: string };

const [officesFile, taluksFile] = process.argv.slice(2);
if (!officesFile || !taluksFile) throw new Error("Usage: build-india-locations.ts <post-offices.json> <pincode-taluks.json>");

// ISO 3166-2:IN codes for the 28 states and 8 union territories
const STATES: [code: string, name: string, ut: boolean][] = [
    ["AP", "Andhra Pradesh", false], ["AR", "Arunachal Pradesh", false], ["AS", "Assam", false], ["BR", "Bihar", false],
    ["CT", "Chhattisgarh", false], ["GA", "Goa", false], ["GJ", "Gujarat", false], ["HR", "Haryana", false],
    ["HP", "Himachal Pradesh", false], ["JH", "Jharkhand", false], ["KA", "Karnataka", false], ["KL", "Kerala", false],
    ["MP", "Madhya Pradesh", false], ["MH", "Maharashtra", false], ["MN", "Manipur", false], ["ML", "Meghalaya", false],
    ["MZ", "Mizoram", false], ["NL", "Nagaland", false], ["OR", "Odisha", false], ["PB", "Punjab", false],
    ["RJ", "Rajasthan", false], ["SK", "Sikkim", false], ["TN", "Tamil Nadu", false], ["TG", "Telangana", false],
    ["TR", "Tripura", false], ["UP", "Uttar Pradesh", false], ["UT", "Uttarakhand", false], ["WB", "West Bengal", false],
    ["AN", "Andaman and Nicobar Islands", true], ["CH", "Chandigarh", true], ["DH", "Dadra and Nagar Haveli and Daman and Diu", true],
    ["DL", "Delhi", true], ["JK", "Jammu and Kashmir", true], ["LA", "Ladakh", true], ["LD", "Lakshadweep", true], ["PY", "Puducherry", true],
];
const SOURCE_STATE: Record<string, string> = {
    "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", Assam: "AS", Bihar: "BR", Chattisgarh: "CT", Chhattisgarh: "CT", Goa: "GA",
    Gujarat: "GJ", Haryana: "HR", "Himachal Pradesh": "HP", Jharkhand: "JH", Karnataka: "KA", Kerala: "KL", "Madhya Pradesh": "MP",
    Maharashtra: "MH", Manipur: "MN", Meghalaya: "ML", Mizoram: "MZ", Nagaland: "NL", Odisha: "OR", Orissa: "OR", Punjab: "PB",
    Rajasthan: "RJ", Sikkim: "SK", "Tamil Nadu": "TN", Telangana: "TG", Tripura: "TR", "Uttar Pradesh": "UP", Uttarakhand: "UT",
    "West Bengal": "WB", "Andaman & Nicobar": "AN", Chandigarh: "CH", "Dadra & Nagar Haveli": "DH", "Daman & Diu": "DH", Delhi: "DL",
    "Jammu & Kashmir": "JK", Lakshadweep: "LD", Pondicherry: "PY", Puducherry: "PY",
};
const LADAKH_DISTRICTS = new Set(["Leh", "Kargil"]);
// Districts renamed since the source was published (or misspelt in it), keyed by state code
const DISTRICT_RENAMES: Record<string, Record<string, string>> = {
    MH: { "Raigarh(MH)": "Raigad", "Ahmed Nagar": "Ahilyanagar", Aurangabad: "Chhatrapati Sambhajinagar", Osmanabad: "Dharashiv" },
    HR: { Gurgaon: "Gurugram" },
    JK: { Ananthnag: "Anantnag", Rajauri: "Rajouri", Bandipur: "Bandipora" },
    KA: { Bangalore: "Bengaluru Urban", "Bangalore Rural": "Bengaluru Rural" },
    DH: { "Dadra & Nagar Haveli": "Dadra and Nagar Haveli" },
};

const clean = (s: string) => s.replace(/\*+/g, "").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").replace(/-(?=[A-Za-z])/g, " - ").replace(/\s+/g, " ").trim();
const titleIfCaps = (s: string) => (s === s.toUpperCase() && /[A-Z]{3,}/.test(s) ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const offices = JSON.parse(fs.readFileSync(officesFile, "utf8")) as Office[];
const taluks = JSON.parse(fs.readFileSync(taluksFile, "utf8")) as Taluk[];

// PIN → taluka (first seen); B's "district" column holds the sub-district
const talukOf = new Map<string, string>();
for (const t of taluks) {
    if (t.pincode == null || !t.district) continue;
    const pin = String(t.pincode).padStart(6, "0");
    const name = titleIfCaps(clean(String(t.district)));
    if (name && !talukOf.has(pin)) talukOf.set(pin, name);
}

const stateIdx = new Map(STATES.map(([code], i) => [code, i]));
const districts: [number, string][] = [];
const districtIdx = new Map<string, number>();
const cities: [number, string][] = [];
const cityIdx = new Map<string, number>();
const localities: [number, string, string][] = [];
const seen = new Set<string>();
const unknownStates = new Set<string>();

for (const o of offices) {
    let code = SOURCE_STATE[o.state?.trim()];
    if (!code) { unknownStates.add(o.state); continue; }
    let district = titleIfCaps(clean(o.district ?? ""));
    if (!district) continue;
    if (code === "JK" && LADAKH_DISTRICTS.has(district)) code = "LA";
    district = DISTRICT_RENAMES[code]?.[district] ?? district;
    const pin = String(o.pincode).replace(/\D/g, "").padStart(6, "0");
    if (!/^[1-9]\d{5}$/.test(pin)) continue;
    const name = titleIfCaps(clean(o.name ?? ""));
    if (!name) continue;

    const s = stateIdx.get(code)!;
    const dKey = `${s}|${key(district)}`;
    let d = districtIdx.get(dKey);
    if (d === undefined) { d = districts.length; districts.push([s, district]); districtIdx.set(dKey, d); }

    // City / taluka from the PIN; a taluka with the district's name, or none, files under the district itself
    const taluk = talukOf.get(pin);
    const city = taluk && !/^(na|nil|not available)$/i.test(taluk) ? taluk : district;
    const cKey = `${d}|${key(city)}`;
    let c = cityIdx.get(cKey);
    if (c === undefined) { c = cities.length; cities.push([d, city]); cityIdx.set(cKey, c); }

    const lKey = `${c}|${key(name)}|${pin}`;
    if (seen.has(lKey)) continue;
    seen.add(lKey);
    localities.push([c, name, pin]);
}

// Area names from the PIN file (e.g. "Salt Lake" for 700091) that aren't a post office name — added under the PIN's existing city
const pinHome = new Map<string, number>();
for (const [c, , p] of localities) if (!pinHome.has(p)) pinHome.set(p, c);
let areas = 0;
for (const t of taluks as (Taluk & { village?: string })[]) {
    if (t.pincode == null || !t.village) continue;
    const pin = String(t.pincode).padStart(6, "0");
    const c = pinHome.get(pin);
    if (c === undefined) continue;
    const name = titleIfCaps(clean(String(t.village)));
    if (!name || /\b(na|nil)\b/i.test(name) || name.includes("/") || key(name) === key(cities[c][1]) || key(name) === key(districts[cities[c][0]][1])) continue;
    const lKey = `${c}|${key(name)}|${pin}`;
    if (seen.has(lKey)) continue;
    seen.add(lKey);
    localities.push([c, name, pin]);
    areas++;
}
console.log(`added ${areas} area names from the PIN file`);

const sortBy = <T>(xs: T[], f: (x: T) => string) => xs.map((x, i) => [x, i] as const).sort((a, b) => f(a[0]).localeCompare(f(b[0])));

// Re-number districts / cities alphabetically so the API can return them in order without sorting
const dOrder = sortBy(districts, ([s, n]) => `${String(s).padStart(2, "0")}|${n}`);
const dMap = new Map(dOrder.map(([, oldI], newI) => [oldI, newI]));
const outDistricts = dOrder.map(([d]) => d);
const cRemapped = cities.map(([d, n]) => [dMap.get(d)!, n] as [number, string]);
const cOrder = sortBy(cRemapped, ([d, n]) => `${String(d).padStart(4, "0")}|${n}`);
const cMap = new Map(cOrder.map(([, oldI], newI) => [oldI, newI]));
const outCities = cOrder.map(([c]) => c);
const outLocalities = localities.map(([c, n, p]) => [cMap.get(c)!, n, p] as [number, string, string])
    .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));

const out = {
    version: 1,
    source: "India Post all-India PIN code directory (post office, district, state) with sub-district / taluka per PIN; cleaned and mapped to current states and UTs.",
    generatedAt: new Date().toISOString(),
    states: STATES,
    districts: outDistricts,
    cities: outCities,
    localities: outLocalities,
};
const dest = path.resolve(__dirname, "../../src/lib/geo/india-locations.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`states ${STATES.length} · districts ${outDistricts.length} · cities/talukas ${outCities.length} · localities ${outLocalities.length} · PINs ${new Set(outLocalities.map((l) => l[2])).size}`);
console.log(`→ ${path.relative(process.cwd(), dest)} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
if (unknownStates.size) console.log("skipped unknown states:", [...unknownStates]);
const empty = STATES.filter((_, i) => !outDistricts.some(([s]) => s === i)).map(([, n]) => n);
if (empty.length) console.log("states with no data:", empty);
