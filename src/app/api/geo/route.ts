import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { bad } from "@/lib/mock/fin/http";
import { geoCities, geoDistricts, geoLocalities, geoPin, geoSearch, geoState, geoStates, geoDistrict, isPincode } from "@/lib/geo/india";

/**
 * India location lookup (no country selection — every location is in India).
 *   ?level=states
 *   ?level=districts&state=MH
 *   ?level=cities&district=MH:pune
 *   ?level=localities&city=MH:pune:mulshi[&q=]   (or &district= to search a whole district)
 *   ?level=search&q=hinjawadi | 411057           India-wide quick search
 *   ?level=pincode&pin=411057                   where a PIN is
 */
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const q = new URL(request.url).searchParams;
    const level = q.get("level");
    const cache = { headers: { "Cache-Control": "private, max-age=3600" } };

    switch (level) {
        case "states":
            return NextResponse.json(geoStates(), cache);
        case "districts": {
            const s = q.get("state") ?? "";
            if (!geoState(s)) return bad("Unknown state");
            return NextResponse.json(geoDistricts(s), cache);
        }
        case "cities": {
            const d = q.get("district") ?? "";
            if (!geoDistrict(d)) return bad("Unknown district");
            return NextResponse.json(geoCities(d), cache);
        }
        case "localities": {
            const cityId = q.get("city") || undefined;
            const districtId = q.get("district") || undefined;
            if (!cityId && !districtId) return bad("city or district is required");
            return NextResponse.json(geoLocalities(me.orgId, { cityId, districtId, q: q.get("q") ?? "", limit: Math.min(100, Number(q.get("limit")) || 50) }));
        }
        case "search":
            return NextResponse.json(geoSearch(me.orgId, q.get("q") ?? "", 20));
        case "pincode": {
            const pin = (q.get("pin") ?? "").trim();
            if (!isPincode(pin)) return bad("PIN code must be exactly 6 digits");
            return NextResponse.json(geoPin(me.orgId, pin));
        }
        default:
            return bad("level must be states, districts, cities, localities, search or pincode");
    }
}
