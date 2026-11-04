"use client";

import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, MapPin, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Combobox, Field, inputCls, type Option } from "./controls";

interface State { code: string; name: string; type: "STATE" | "UT" }
interface District { id: string; stateCode: string; name: string }
interface City { id: string; districtId: string; name: string }
interface Place { locality: string; pincode: string; city: City; district: District; state: State; custom?: boolean }
interface PinInfo { pincode: string; known: boolean; districts: { id: string; name: string; stateCode: string; stateName: string }[]; localities: Place[] }

export interface LocationValue {
    locationStateCode: string; locationStateName: string;
    locationDistrictId: string; locationDistrictName: string;
    locationCityId: string; locationCityName: string;
    locationLocality: string; locationPincode: string;
}
export const EMPTY_LOCATION: LocationValue = {
    locationStateCode: "", locationStateName: "", locationDistrictId: "", locationDistrictName: "",
    locationCityId: "", locationCityName: "", locationLocality: "", locationPincode: "",
};
export const locationSummary = (v: LocationValue) => {
    const parts = [v.locationLocality, v.locationCityName, v.locationDistrictName && v.locationDistrictName !== v.locationCityName ? v.locationDistrictName : "", v.locationStateName].filter(Boolean);
    return parts.join(", ") + (v.locationPincode ? ` – ${v.locationPincode}` : "");
};

const STALE = 60 * 60 * 1000;

/**
 * Indian location: quick search (locality or PIN) or State/UT → District → City / Taluka → Locality → PIN.
 * Changing a parent clears its children. The PIN is checked against the India Post directory and a
 * mismatch is shown as a warning — the recruiter's selection is never changed silently.
 */
export function IndiaLocationPicker({ value, onChange, errors = {}, required }: {
    value: LocationValue; onChange: (v: LocationValue) => void; errors?: Partial<Record<keyof LocationValue | "locationPincode", string>>; required: { area: boolean; place: boolean };
}) {
    const [quick, setQuick] = useState("");
    const quickQ = useDeferredValue(quick.trim());
    const [localityQ, setLocalityQ] = useState("");
    const locQ = useDeferredValue(localityQ.trim());

    const states = useQuery<State[]>({ queryKey: ["geo", "states"], queryFn: () => api("/api/geo?level=states"), staleTime: STALE });
    const districts = useQuery<District[]>({ queryKey: ["geo", "districts", value.locationStateCode], queryFn: () => api(`/api/geo?level=districts&state=${value.locationStateCode}`), enabled: !!value.locationStateCode, staleTime: STALE });
    const cities = useQuery<City[]>({ queryKey: ["geo", "cities", value.locationDistrictId], queryFn: () => api(`/api/geo?level=cities&district=${encodeURIComponent(value.locationDistrictId)}`), enabled: !!value.locationDistrictId, staleTime: STALE });
    // Localities: within the chosen city, or the whole district before a city is chosen
    const scope = value.locationCityId ? `city=${encodeURIComponent(value.locationCityId)}` : value.locationDistrictId ? `district=${encodeURIComponent(value.locationDistrictId)}` : "";
    const localities = useQuery<Place[]>({ queryKey: ["geo", "localities", scope, locQ], queryFn: () => api(`/api/geo?level=localities&${scope}&q=${encodeURIComponent(locQ)}&limit=80`), enabled: !!scope });
    const search = useQuery<Place[]>({ queryKey: ["geo", "search", quickQ], queryFn: () => api(`/api/geo?level=search&q=${encodeURIComponent(quickQ)}`), enabled: quickQ.length >= 3 || /^\d{3,6}$/.test(quickQ) });
    const pinOk = /^[1-9]\d{5}$/.test(value.locationPincode);
    const pin = useQuery<PinInfo>({ queryKey: ["geo", "pin", value.locationPincode], queryFn: () => api(`/api/geo?level=pincode&pin=${value.locationPincode}`), enabled: pinOk, staleTime: STALE });

    const pick = (p: Place) => {
        onChange({
            locationStateCode: p.state.code, locationStateName: p.state.name, locationDistrictId: p.district.id, locationDistrictName: p.district.name,
            locationCityId: p.city.id, locationCityName: p.city.name, locationLocality: p.locality, locationPincode: p.pincode,
        });
        setQuick("");
    };

    const stateOpts: Option[] = (states.data ?? []).map((s) => ({ value: s.code, label: s.name, hint: s.type === "UT" ? "Union Territory" : undefined }));
    const districtOpts: Option[] = (districts.data ?? []).map((d) => ({ value: d.id, label: d.name }));
    const cityOpts: Option[] = (cities.data ?? []).map((c) => ({ value: c.id, label: c.name }));
    const localityOpts: Option[] = (localities.data ?? []).map((p) => ({ value: `${p.city.id}|${p.locality}|${p.pincode}`, label: p.locality, hint: `${p.city.name} · ${p.pincode}${p.custom ? " · added by your team" : ""}` }));

    // PIN vs. selection
    const pinInfo = pin.data;
    const pinMismatch = pinOk && pinInfo && pinInfo.known && value.locationDistrictId && !pinInfo.districts.some((d) => d.id === value.locationDistrictId);
    const pinUnknown = pinOk && pinInfo && !pinInfo.known;
    const pinMatches = pinOk && pinInfo && pinInfo.known && !pinMismatch && !!value.locationDistrictId;

    return (
        <div className="space-y-4">
            {/* Quick search */}
            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick search a locality or PIN — e.g. Hinjawadi, Whitefield, 400069"
                    className={`${inputCls()} pl-9`} aria-label="Search locality or PIN code" />
                {quickQ && (quickQ.length >= 3 || /^\d{3,6}$/.test(quickQ)) && (
                    <ul className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg py-1 text-sm">
                        {search.isFetching && !search.data && <li className="px-3 py-2 text-xs text-neutral-400">Searching…</li>}
                        {search.data?.length === 0 && <li className="px-3 py-2 text-xs text-neutral-400">No locality found — pick the state, district and city below and type the locality.</li>}
                        {search.data?.map((p, i) => (
                            <li key={`${p.city.id}-${p.locality}-${p.pincode}-${i}`}>
                                <button type="button" onClick={() => pick(p)} className="w-full text-left px-3 py-2 hover:bg-primary/5 flex items-start gap-2">
                                    <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                        <span className="block font-semibold text-neutral-800 truncate">{p.locality} <span className="font-normal text-neutral-400">· {p.pincode}</span></span>
                                        <span className="block text-xs text-neutral-500 truncate">{p.city.name}, {p.district.name}, {p.state.name}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="State / UT" required={required.area} error={errors.locationStateCode} htmlFor="loc-state">
                    <Combobox id="loc-state" options={stateOpts} value={value.locationStateCode} loading={states.isLoading} placeholder="Search state or UT"
                        onChange={(v, o) => onChange({ ...EMPTY_LOCATION, locationStateCode: v, locationStateName: o?.label ?? "" })} error={errors.locationStateCode} />
                </Field>
                <Field label="District" required={required.area} error={errors.locationDistrictId} htmlFor="loc-district" hint={!value.locationStateCode ? "Select a state first" : undefined}>
                    <Combobox id="loc-district" options={districtOpts} value={value.locationDistrictId} disabled={!value.locationStateCode} loading={districts.isLoading} placeholder="Search district"
                        onChange={(v, o) => onChange({ ...value, locationDistrictId: v, locationDistrictName: o?.label ?? "", locationCityId: "", locationCityName: "", locationLocality: "", locationPincode: "" })} error={errors.locationDistrictId} />
                </Field>
                <Field label="City / Taluka" required={required.area} error={errors.locationCityId} htmlFor="loc-city" hint={!value.locationDistrictId ? "Select a district first" : "Town or taluka / tehsil as per India Post"}>
                    <Combobox id="loc-city" options={cityOpts} value={value.locationCityId} disabled={!value.locationDistrictId} loading={cities.isLoading} placeholder="Search city or taluka"
                        onChange={(v, o) => onChange({ ...value, locationCityId: v, locationCityName: o?.label ?? "", locationLocality: "", locationPincode: "" })} error={errors.locationCityId} />
                </Field>
                <Field label="Locality / Area" required={required.place} error={errors.locationLocality} htmlFor="loc-locality"
                    hint={!value.locationDistrictId ? "Select a district first" : "Pick from the list, or type a locality and choose “Use …” if it isn't listed"}>
                    <Combobox id="loc-locality" options={localityOpts} value={value.locationLocality} disabled={!value.locationDistrictId} allowCustom
                        onSearch={setLocalityQ} loading={localities.isFetching} placeholder="Search locality, e.g. Andheri East"
                        customLabel={(q) => `Use “${q}” as the locality`}
                        onChange={(v, o) => {
                            if (o) {
                                const p = (localities.data ?? []).find((x) => `${x.city.id}|${x.locality}|${x.pincode}` === v);
                                if (p) { onChange({ ...value, locationCityId: p.city.id, locationCityName: p.city.name, locationLocality: p.locality, locationPincode: p.pincode }); return; }
                            }
                            onChange({ ...value, locationLocality: v.replace(/\s+/g, " ").trim().slice(0, 120) });
                        }}
                        error={errors.locationLocality} />
                </Field>
                <Field label="PIN code" required={required.place} error={errors.locationPincode} htmlFor="loc-pin">
                    <input id="loc-pin" inputMode="numeric" maxLength={6} value={value.locationPincode} placeholder="6-digit PIN"
                        onChange={(e) => onChange({ ...value, locationPincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        className={inputCls(errors.locationPincode || (value.locationPincode.length > 0 && value.locationPincode.length < 6) ? "x" : null)} />
                    {value.locationPincode.length > 0 && !pinOk && !errors.locationPincode && <p className="text-xs text-amber-600">A PIN code has exactly 6 digits and doesn&apos;t start with 0.</p>}
                    {pinMatches && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Matches {pinInfo!.districts[0]?.name}, {pinInfo!.districts[0]?.stateName}</p>}
                    {pinMismatch && (
                        <p className="text-xs text-amber-700 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />
                            <span>PIN {value.locationPincode} belongs to {pinInfo!.districts.map((d) => `${d.name}, ${d.stateName}`).join(" / ")} — not {value.locationDistrictName}. Check the PIN or the location.</span>
                        </p>
                    )}
                    {pinUnknown && <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> Not in the India Post directory — please double-check.</p>}
                </Field>
            </div>
            {pinOk && pinInfo && pinInfo.known && !value.locationDistrictId && pinInfo.localities[0] && (
                <button type="button" onClick={() => pick(pinInfo.localities[0])} className="text-xs font-semibold text-primary hover:underline">
                    Fill from PIN: {pinInfo.localities[0].locality}, {pinInfo.localities[0].city.name}, {pinInfo.localities[0].state.name}
                </button>
            )}
        </div>
    );
}
