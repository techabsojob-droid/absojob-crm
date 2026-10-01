import { NextResponse } from "next/server";
import { billingOf, clientById, sendEmail, settingsFor, statementOf } from "@/lib/mock/finance";
import { bad, body, csvResponse, requireFinance } from "@/lib/mock/fin/http";

// Client statement of account (running balance); ?format=csv to download
export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const url = new URL(request.url);
    const client = clientById(me.orgId, url.searchParams.get("clientId"));
    if (!client) return bad("Client not found", 404);
    const st = statementOf(me.orgId, client.id, url.searchParams.get("from") || undefined, url.searchParams.get("to") || undefined);
    if (url.searchParams.get("format") === "csv") {
        const rows = [["Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance"], ["", "Opening", "", "", "", "", st.opening], ...st.lines.map((l) => [l.date, l.type, l.ref, l.description, l.debit || "", l.credit || "", l.balance])];
        return csvResponse(rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"), `statement-${client.companyName.replace(/\W+/g, "-")}.csv`);
    }
    return NextResponse.json({ client: { id: client.id, name: client.companyName, ...billingOf(client) }, company: settingsFor(me.orgId).companyLegalName, ...st });
}

// POST: email the statement to the client's billing contacts
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const client = clientById(me.orgId, b.clientId);
    if (!client) return bad("Client not found", 404);
    const st = statementOf(me.orgId, client.id);
    const rows = st.lines.map((l) => `<tr><td>${l.date}</td><td>${l.type}</td><td>${l.ref}</td><td align="right">${l.debit || ""}</td><td align="right">${l.credit || ""}</td><td align="right">${l.balance}</td></tr>`).join("");
    const mail = sendEmail(me.orgId, me, {
        to: billingOf(client).billingEmails,
        subject: `Statement of account — ${client.companyName} (balance ₹${st.closing.toLocaleString("en-IN")})`,
        html: `<p>Dear ${client.contactPerson},</p><p>Please find your statement of account below. Closing balance: <b>₹${st.closing.toLocaleString("en-IN")}</b>.</p><table border="1" cellpadding="4" style="border-collapse:collapse"><tr><th>Date</th><th>Type</th><th>Ref</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>${rows}</table><p>${settingsFor(me.orgId).companyLegalName}</p>`,
        relatedType: "Client", relatedId: client.id,
    });
    return NextResponse.json({ sent: mail.status !== "FAILED", to: mail.to, status: mail.status });
}
