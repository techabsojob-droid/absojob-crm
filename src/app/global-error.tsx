"use client";

// Last-resort screen when the root layout itself fails (replaces the whole document)
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body style={{ fontFamily: "system-ui, sans-serif", background: "#F3F5F8", margin: 0 }}>
                <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                    <div style={{ maxWidth: 420, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 16, padding: 32, textAlign: "center" }}>
                        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>This page couldn&apos;t load right now</h1>
                        <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px" }}>The server is busy or the database didn&apos;t respond in time. Please try again in a moment.</p>
                        <button onClick={() => reset()} style={{ height: 40, padding: "0 20px", borderRadius: 12, border: 0, background: "#142B4A", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Try again</button>
                        {error.digest && <p style={{ fontSize: 11, color: "#999", marginTop: 16 }}>Reference: {error.digest}</p>}
                    </div>
                </div>
            </body>
        </html>
    );
}
