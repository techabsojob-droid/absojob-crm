// ─── Resume parsing (rule-based, server only) ─────────────────
// File → plain text → fields. Every field is either read from the resume
// text or left null; nothing is guessed. Raw text is never stored or returned.

export const RESUME_TYPES = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;
export type ResumeMime = keyof typeof RESUME_TYPES;
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

export interface ParsedWork { company: string | null; designation: string | null; startDate: string | null; endDate: string | null; current: boolean }
export interface ParsedEducation { degree: string | null; institution: string | null; year: string | null }

export interface ParsedResume {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    currentCompany: string | null;
    currentDesignation: string | null;
    totalExperienceYears: number | null;
    totalExperienceSource: "STATED" | "FROM_DATES" | null;
    relevantExperienceYears: number | null;
    previousCompanies: string[];
    previousDesignations: string[];
    workExperience: ParsedWork[];
    skills: string[];
    programmingLanguages: string[];
    frameworks: string[];
    tools: string[];
    domains: string[];
    highestQualification: string | null;
    education: ParsedEducation[];
    certifications: string[];
    projects: string[];
    noticePeriodDays: number | null;
    currentCtcLpa: number | null;
    expectedCtcLpa: number | null;
}

export class ResumeParseError extends Error {}

// ─── 1. File validation + text extraction ─────────────────────

function sniff(buf: Buffer): "pdf" | "doc" | "docx" | null {
    if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "docx";
    if (buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "doc";
    return null;
}

export async function extractResumeText(buf: Buffer, mimeType: string): Promise<{ text: string; pages: number | null }> {
    const declared = RESUME_TYPES[mimeType as ResumeMime];
    if (!declared) throw new ResumeParseError("Resume must be a PDF, DOC or DOCX file");
    if (buf.length > RESUME_MAX_BYTES) throw new ResumeParseError("Resume is larger than 5 MB");
    const actual = sniff(buf);
    // The file's own bytes decide the format; a renamed file of another type is rejected
    if (!actual || actual !== declared) throw new ResumeParseError("The file content does not match a PDF, DOC or DOCX resume");

    try {
        if (actual === "pdf") {
            const { getDocumentProxy } = await import("unpdf");
            const pdf = await getDocumentProxy(new Uint8Array(buf));
            const pages: string[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                // Rebuild lines from the text items' vertical position so layout survives
                let out = "";
                let lastY: number | null = null;
                for (const item of content.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
                    if (typeof item.str !== "string") continue;
                    const y = item.transform?.[5] ?? null;
                    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
                    else if (out && !out.endsWith("\n") && !out.endsWith(" ") && item.str && !item.str.startsWith(" ")) out += " ";
                    out += item.str;
                    if (item.hasEOL) out += "\n";
                    if (y !== null) lastY = y;
                }
                pages.push(out);
            }
            return { text: pages.join("\n"), pages: pdf.numPages };
        }
        if (actual === "docx") {
            const mammoth = await import("mammoth");
            const { value } = await mammoth.extractRawText({ buffer: buf });
            return { text: value, pages: null };
        }
        const WordExtractor = (await import("word-extractor")).default;
        const doc = await new WordExtractor().extract(buf);
        return { text: doc.getBody(), pages: null };
    } catch (e) {
        if (e instanceof ResumeParseError) throw e;
        throw new ResumeParseError("Could not read this file. It may be corrupted or password protected.");
    }
}

// ─── 2. Text → fields ─────────────────────────────────────────

const clean = (s: string) => s.replace(/[•●▪■‣⁃∙·*▪►•●◦]/g, " ").replace(/\s+/g, " ").trim();
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const uniqCi = (xs: string[]) => {
    const seen = new Set<string>();
    return xs.filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
};

// Section headings → section key. A heading is a short line on its own.
const SECTIONS: [RegExp, string][] = [
    [/^(professional |work |employment |career )?(experience|history|background)( summary| details)?$|^employment$|^work history$|^experience$|^professional experience$|^career history$/i, "experience"],
    [/^(education|educational (qualifications?|details|background)|academic (qualifications?|details|background|profile)|qualifications?|academics)$/i, "education"],
    [/^((key |technical |core |professional )?skills?( set| summary)?|technical (expertise|proficiency)|core competenc(y|ies)|technologies|tech stack|it skills|areas of expertise)$/i, "skills"],
    [/^(certifications?|certificates?|licen[cs]es?( (and|&) certifications?)?|courses?( (and|&) certifications?)?|trainings?( (and|&) certifications?)?)$/i, "certifications"],
    [/^((key |academic |personal |major )?projects?( undertaken| details)?)$/i, "projects"],
    [/^(summary|profile|professional summary|career (objective|summary)|objective|about me|profile summary|career profile)$/i, "summary"],
    [/^(personal (details|information|profile)|contact( details| information)?)$/i, "personal"],
    [/^(achievements|awards|honou?rs|interests|hobbies|languages( known)?|declaration|references|extra[- ]curricular( activities)?|strengths)$/i, "other"],
];

function sectionOf(line: string): string | null {
    const l = line.replace(/[:\-–—_|]+$/, "").replace(/^[^a-z]+/i, "").trim();
    if (!l || l.length > 40 || l.split(" ").length > 5) return null;
    for (const [re, key] of SECTIONS) if (re.test(l)) return key;
    return null;
}

function splitSections(lines: string[]) {
    const sections: Record<string, string[]> = { header: [] };
    let current = "header";
    for (const line of lines) {
        const s = sectionOf(line);
        if (s) { current = s; sections[current] ??= []; continue; }
        (sections[current] ??= []).push(line);
    }
    return sections;
}

// ─── Contact details ──────────────────────────────────────────

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(s);

/** Normalises a phone number; returns null unless it has 10 digits (+ optional country code). */
export function normalisePhone(raw: string): string | null {
    const hasPlus = raw.trim().startsWith("+");
    let d = raw.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
    if (d.length === 11 && d.startsWith("0") && /^[6-9]/.test(d.slice(1))) d = d.slice(1);
    if (d.length === 10 && /^[6-9]/.test(d)) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
    // Landlines keep the number as written (with STD code)
    if ((d.length === 10 || d.length === 11) && d.startsWith("0")) return clean(raw);
    if (hasPlus && d.length >= 11 && d.length <= 15) return `+${d}`;
    return null;
}

function findPhone(text: string): string | null {
    const candidates = text.match(/(?:\+\s?\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{2,4})?/g) ?? [];
    for (const c of candidates) {
        // Skip date ranges and years that only look like digits
        if (/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(c.trim())) continue;
        const p = normalisePhone(c);
        if (p) return p;
    }
    return null;
}

function findUrls(rawText: string) {
    const text = rawText.replace(EMAIL_RE, " ");
    const urls = (text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,;|)]*)?/gi) ?? [])
        .filter((u) => !u.includes("@") && /[a-z]/i.test(u) && /\.[a-z]{2,}/i.test(u));
    const norm = (u: string) => (u.startsWith("http") ? u : `https://${u}`).replace(/[.)]+$/, "");
    const linkedin = urls.find((u) => /linkedin\.com\/(in|pub)\//i.test(u));
    const github = urls.find((u) => /github\.com\/[A-Za-z0-9-]+/i.test(u));
    const portfolio = urls.find((u) =>
        !/linkedin\.com|github\.com|gmail|yahoo|outlook|hotmail|google\.com|microsoft\.com|coursera|udemy/i.test(u)
        && (/^https?:\/\//i.test(u) || /^www\./i.test(u) || /\.(dev|io|me|site|app|portfolio|vercel\.app|netlify\.app)(\/|$)/i.test(u)));
    return { linkedinUrl: linkedin ? norm(linkedin) : null, githubUrl: github ? norm(github) : null, portfolioUrl: portfolio ? norm(portfolio) : null };
}

const NOT_NAME = /resume|curriculum|vitae|\bcv\b|profile|email|phone|mobile|contact|address|linkedin|github|objective|summary|@|\d|www\.|http/i;

function findName(header: string[], email: string | null): string | null {
    for (const raw of header.slice(0, 8)) {
        // Name is often on the same line as contact info: "Priya Sharma | priya@x.com"
        const part = clean(raw.split(/[|,•·]| {3,}|\t/)[0] ?? "");
        const label = part.match(/^name\s*[:\-]\s*(.+)$/i);
        const cand = label ? label[1].trim() : part;
        if (!cand || NOT_NAME.test(cand)) continue;
        const words = cand.split(" ");
        if (words.length < 2 || words.length > 4) continue;
        if (!words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w))) continue;
        if (sectionOf(cand)) continue;
        const titled = cand === cand.toUpperCase()
            ? words.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")
            : cand;
        return titled;
    }
    // Fall back to an explicit "Name:" label anywhere in the header
    for (const raw of header) {
        const m = raw.match(/^\s*(?:full\s*)?name\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,60})$/i);
        if (m) return clean(m[1]);
    }
    void email;
    return null;
}

const CITIES = ["Mumbai", "Navi Mumbai", "Thane", "Pune", "Bengaluru", "Bangalore", "Hyderabad", "Secunderabad", "Chennai", "Kolkata", "Delhi", "New Delhi", "Noida", "Greater Noida", "Gurugram", "Gurgaon", "Faridabad", "Ghaziabad", "Ahmedabad", "Gandhinagar", "Surat", "Vadodara", "Jaipur", "Lucknow", "Kanpur", "Indore", "Bhopal", "Nagpur", "Nashik", "Aurangabad", "Chandigarh", "Mohali", "Kochi", "Cochin", "Trivandrum", "Thiruvananthapuram", "Coimbatore", "Madurai", "Mysuru", "Mysore", "Mangaluru", "Mangalore", "Visakhapatnam", "Vijayawada", "Bhubaneswar", "Patna", "Ranchi", "Guwahati", "Dehradun", "Goa", "Panaji", "Raipur", "Ludhiana", "Amritsar", "Jalandhar", "Kota", "Udaipur", "Jodhpur", "Varanasi", "Agra", "Meerut", "Rajkot", "Hubli", "Belgaum", "Tiruchirappalli", "Pondicherry", "Puducherry", "Jammu", "Srinagar", "Shimla", "Dubai", "Abu Dhabi", "Singapore", "London", "New York", "San Francisco", "Toronto", "Sydney"];
const CITY_RE = new RegExp(`\\b(${CITIES.map((c) => c.replace(/ /g, "\\s+")).join("|")})\\b`, "i");

function findLocation(lines: string[], header: string[], personal: string[]): string | null {
    for (const l of [...header, ...personal, ...lines.slice(0, 40)]) {
        const m = l.match(/\b(?:current\s+)?(?:location|city|address|based in|residing at)\s*[:\-]\s*([^|•\n]{2,80})/i);
        if (m) return clean(m[1]).replace(/[,.]$/, "");
    }
    for (const l of header.slice(0, 10)) {
        const m = l.match(CITY_RE);
        if (m) {
            const city = CITIES.find((c) => c.toLowerCase() === m[1].replace(/\s+/g, " ").toLowerCase()) ?? m[1];
            return city;
        }
    }
    return null;
}

// ─── Dates & employment history ───────────────────────────────

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?";
const POINT = `(?:${MONTH}\\s*[',]?\\s*(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[\\/.-](?:19|20)\\d{2}|(?:19|20)\\d{2})`;
const NOW = "(?:present|current|currently|till\\s+(?:date|now)|to\\s+date|now|ongoing|today)";
const RANGE_RE = new RegExp(`(${POINT})\\s*(?:-|–|—|to|till|until|~)\\s*(${POINT}|${NOW})`, "i");

function toMonthIndex(s: string): number | null {
    const t = s.toLowerCase().trim();
    if (new RegExp(`^${NOW}$`, "i").test(t)) { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); }
    let m = t.match(new RegExp(`^(${MONTH})\\s*[',]?\\s*((?:19|20)\\d{2})$`, "i"));
    if (m) return Number(m[2]) * 12 + (MONTHS[m[1].replace(/\./, "").slice(0, m[1].toLowerCase().startsWith("sept") ? 4 : 3)] ?? 0);
    m = t.match(/^(0?[1-9]|1[0-2])[/.-]((?:19|20)\d{2})$/);
    if (m) return Number(m[2]) * 12 + Number(m[1]) - 1;
    m = t.match(/^((?:19|20)\d{2})$/);
    if (m) return Number(m[1]) * 12;
    return null;
}

const ROLE_WORDS = /\b(engineer|developer|programmer|manager|analyst|consultant|lead|intern|trainee|executive|designer|architect|specialist|officer|associate|director|head|recruiter|administrator|admin|tester|qa|scientist|coordinator|accountant|advisor|representative|supervisor|technician|strategist|founder|co-founder|owner|president|vp|partner|assistant|sde|swe|devops|sre|staff|principal|member of technical staff|mts|writer|editor|marketer|counsel|teacher|lecturer|professor)\b/i;
// Legal suffixes make a phrase a company even when it contains a role word ("Software")
const LEGAL_SUFFIX = /\b(pvt|private|ltd|limited|llp|llc|inc|corp|corporation|gmbh|plc|co\.)\b\.?/i;
const COMPANY_HINT = /\b(pvt|private|ltd|limited|llp|inc|corp|corporation|technologies|technology|solutions|systems|services|labs|software|consulting|consultancy|infotech|bank|group|global|industries|enterprises|ventures|digital|networks|studio|media|healthcare|pharma|motors|finance|financial|capital|university|institute|company|co\.)\b/i;

function splitRoleCompany(text: string): { company: string | null; designation: string | null } {
    const t = clean(text).replace(/^[,|:\-–—\s]+|[,|:\-–—\s]+$/g, "");
    if (!t) return { company: null, designation: null };
    // "Software Engineer at Infosys" / "Software Engineer @ Infosys"
    const at = t.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (at && ROLE_WORDS.test(at[1])) return { designation: at[1].trim(), company: at[2].trim() };
    const parts = t.split(/\s*(?:\||,|–|—| - |\t| {2,})\s*/).map((p) => p.trim()).filter((p) => p && !CITY_RE.test(p) || (p && p.split(" ").length > 2));
    let designation: string | null = null;
    let company: string | null = null;
    for (const p of parts) {
        const legal = LEGAL_SUFFIX.test(p);
        const role = ROLE_WORDS.test(p) && !legal;
        if (!designation && role) designation = p;
        else if (!company && (legal || COMPANY_HINT.test(p) || (!ROLE_WORDS.test(p) && p.split(" ").length <= 6))) company = p;
    }
    return { company, designation };
}

function parseExperience(lines: string[]): ParsedWork[] {
    const out: ParsedWork[] = [];
    let consumed = -1; // lines up to here already belong to an earlier entry
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const r = line.match(RANGE_RE);
        if (!r) continue;
        const start = clean(r[1]);
        const end = clean(r[2]);
        const current = new RegExp(`^${NOW}$`, "i").test(end);
        // Text on the same line (minus the dates), else the 1–2 lines above it
        const sameLine = clean(line.replace(r[0], " ").replace(/[()]/g, " "));
        let info = splitRoleCompany(sameLine);
        for (const j of [i - 1, i - 2]) {
            if (info.company && info.designation) break;
            const a = lines[j];
            if (j <= consumed || !a || RANGE_RE.test(a) || clean(a).length >= 90 || /^[-–—•●▪*]/.test(a.trim())) break;
            const extra = splitRoleCompany(a);
            info = { company: info.company ?? extra.company, designation: info.designation ?? extra.designation };
        }
        consumed = i;
        if (!info.company && !info.designation) continue;
        out.push({ company: info.company, designation: info.designation, startDate: start, endDate: current ? null : end, current });
    }
    return out;
}

function monthsFromRanges(work: ParsedWork[]): number | null {
    const ranges = work.map((w) => {
        const s = w.startDate ? toMonthIndex(w.startDate) : null;
        const e = w.current ? toMonthIndex("present") : w.endDate ? toMonthIndex(w.endDate) : null;
        return s !== null && e !== null && e >= s ? [s, e] as [number, number] : null;
    }).filter((r): r is [number, number] => !!r).sort((a, b) => a[0] - b[0]);
    if (!ranges.length) return null;
    // Merge overlapping jobs so parallel roles are not double counted
    let total = 0;
    let [cs, ce] = ranges[0];
    for (const [s, e] of ranges.slice(1)) {
        if (s <= ce) ce = Math.max(ce, e);
        else { total += ce - cs; [cs, ce] = [s, e]; }
    }
    total += ce - cs;
    return total;
}

function statedYears(text: string, kind: "total" | "relevant"): number | null {
    const re = kind === "relevant"
        ? /relevant\s+(?:work\s+)?experience\s*(?:of|[:\-])?\s*(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)/i
        : /(?:(?:total|overall)\s+(?:work\s+)?experience\s*(?:of|[:\-])?\s*(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?))|(?:(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s+(?:and\s+)?\d{1,2}\s+months?)?\s+(?:of\s+)?(?:total\s+|overall\s+|professional\s+|industry\s+|work\s+|it\s+)?experience)/i;
    const m = text.match(re);
    const v = m ? Number(m[1] ?? m[2]) : NaN;
    return Number.isFinite(v) && v >= 0 && v < 50 ? v : null;
}

// ─── Skills ───────────────────────────────────────────────────

const LANGUAGES = ["JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Golang", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "Perl", "Dart", "Objective-C", "SQL", "PL/SQL", "T-SQL", "Bash", "Shell", "PowerShell", "HTML", "CSS", "SASS", "Groovy", "Elixir", "Haskell", "Lua", "VBA", "COBOL", "ABAP", "Solidity", "Apex"];
const FRAMEWORKS = ["React", "React.js", "ReactJS", "Next.js", "Angular", "AngularJS", "Vue", "Vue.js", "Nuxt", "Svelte", "Node.js", "NodeJS", "Express", "Express.js", "NestJS", "Django", "Flask", "FastAPI", "Spring", "Spring Boot", "Hibernate", ".NET", "ASP.NET", ".NET Core", "Laravel", "Symfony", "CodeIgniter", "Rails", "Ruby on Rails", "Flutter", "React Native", "Ionic", "Xamarin", "jQuery", "Bootstrap", "Tailwind", "Tailwind CSS", "Material UI", "Redux", "GraphQL", "TensorFlow", "PyTorch", "Keras", "scikit-learn", "Pandas", "NumPy", "Spark", "Apache Spark", "Hadoop", "Kafka", "Selenium", "Cypress", "Jest", "JUnit", "TestNG", "Playwright", "Mocha", "Struts", "Microservices", "Electron", "Gatsby", "Remix", "LangChain"];
const TOOLS = ["AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "GitLab CI", "CI/CD", "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence", "Linux", "Unix", "Nginx", "Apache", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Oracle", "SQL Server", "SQLite", "DynamoDB", "Cassandra", "Elasticsearch", "Firebase", "Supabase", "Snowflake", "BigQuery", "Databricks", "Airflow", "Tableau", "Power BI", "Excel", "Advanced Excel", "Looker", "Figma", "Adobe XD", "Photoshop", "Illustrator", "Postman", "Swagger", "SonarQube", "Grafana", "Prometheus", "Splunk", "ServiceNow", "Salesforce", "SAP", "Tally", "Zoho", "HubSpot", "Webpack", "Vite", "Maven", "Gradle", "npm", "REST", "REST API", "RabbitMQ", "Linux Administration", "VMware", "Visual Studio", "IntelliJ", "Eclipse", "Android Studio", "Xcode", "LinkedIn Recruiter", "Naukri", "ATS"];
const DOMAINS: [string, RegExp][] = [
    ["Banking & Financial Services", /\b(bfsi|banking|financial services|fintech|payments?|lending|nbfc|capital markets|wealth management)\b/i],
    ["Insurance", /\binsurance|insurtech\b/i],
    ["Healthcare", /\b(healthcare|health ?tech|hospital|clinical|pharma(ceutical)?|life sciences|medical)\b/i],
    ["E-commerce & Retail", /\b(e-?commerce|retail|d2c|marketplace)\b/i],
    ["Telecom", /\btelecom(munications)?\b/i],
    ["EdTech & Education", /\b(edtech|e-learning|lms)\b/i],
    ["Logistics & Supply Chain", /\b(logistics|supply chain|warehouse|shipping)\b/i],
    ["Manufacturing", /\bmanufacturing\b/i],
    ["SaaS", /\bsaas\b/i],
    ["Automotive", /\bautomotive\b/i],
    ["Real Estate", /\b(real estate|proptech)\b/i],
    ["Travel & Hospitality", /\b(travel|hospitality|hotel)\b/i],
    ["Media & Entertainment", /\b(media|entertainment|ott|gaming)\b/i],
    ["Recruitment & HR", /\b(recruitment|talent acquisition|staffing|human resources)\b/i],
];

function dictMatch(text: string, dict: string[]): string[] {
    const found: string[] = [];
    for (const term of dict) {
        const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Single letters (C, R) only count inside a skills list, never in prose
        if (term.length === 1) continue;
        if (new RegExp(`(^|[^A-Za-z0-9+#.])${esc}(?![A-Za-z0-9+#])`, term === term.toUpperCase() ? "" : "i").test(text)) found.push(term);
    }
    // Collapse spelling variants
    const variants: Record<string, string> = { "React.js": "React", ReactJS: "React", "Vue.js": "Vue", NodeJS: "Node.js", "Express.js": "Express", Golang: "Go", AngularJS: "Angular", "Tailwind CSS": "Tailwind", "Ruby on Rails": "Rails", "Apache Spark": "Spark", "REST API": "REST", "Google Cloud": "GCP" };
    return uniq(found.map((f) => variants[f] ?? f));
}

function listItems(lines: string[]): string[] {
    return lines
        .flatMap((l) => l.replace(/^[^:]{2,30}:\s*/, (m) => (/[,|]/.test(l) ? "" : m)).split(/\s*[,|;•●▪·•]\s*|\s{3,}|\t/))
        .map((s) => clean(s).replace(/^[-–—\s]+|[.\s]+$/g, ""))
        .filter((s) => s.length >= 1 && s.length <= 40 && s.split(" ").length <= 4 && !/^(and|etc|others?)$/i.test(s));
}

// ─── Education ────────────────────────────────────────────────

const DEGREES: [RegExp, string, number][] = [
    [/\bph\.?\s?d\b|doctorate/i, "PhD", 7],
    [/\bm\.?\s?tech\b|master of technology/i, "M.Tech", 6],
    [/\bm\.?\s?e\.?\b(?=\s|$|,)|master of engineering/i, "M.E.", 6],
    [/\bmba\b|master of business administration|\bpgdm\b/i, "MBA", 6],
    [/\bmca\b|master of computer applications/i, "MCA", 6],
    [/\bm\.?\s?sc\b|master of science/i, "M.Sc", 6],
    [/\bm\.?\s?com\b|master of commerce/i, "M.Com", 6],
    [/\bm\.?\s?a\.?\b(?=\s|$|,)|master of arts/i, "M.A.", 6],
    [/\bmaster'?s?\b/i, "Master's", 6],
    [/\bpost[- ]?graduat/i, "Post Graduate", 6],
    [/\bb\.?\s?tech\b|bachelor of technology/i, "B.Tech", 5],
    [/\bb\.?\s?e\.?\b(?=\s|$|,|\()|bachelor of engineering/i, "B.E.", 5],
    [/\bbca\b|bachelor of computer applications/i, "BCA", 5],
    [/\bbba\b|bachelor of business administration/i, "BBA", 5],
    [/\bb\.?\s?sc\b|bachelor of science/i, "B.Sc", 5],
    [/\bb\.?\s?com\b|bachelor of commerce/i, "B.Com", 5],
    [/\bb\.?\s?a\.?\b(?=\s|$|,)|bachelor of arts/i, "B.A.", 5],
    [/\bllb\b|bachelor of laws/i, "LLB", 5],
    [/\bbachelor'?s?\b/i, "Bachelor's", 5],
    [/\bdiploma\b/i, "Diploma", 4],
    [/\b(12th|xii|hsc|higher secondary|intermediate)\b/i, "12th / HSC", 3],
    [/\b(10th|ssc|matriculation|secondary school)\b/i, "10th / SSC", 2],
];
const INSTITUTION_RE = /\b(university|college|institute|institution|school|academy|iit|nit|iiit|bits|iim|vidyalaya|vidyapeeth|polytechnic)\b/i;

function parseEducation(lines: string[]): ParsedEducation[] {
    const out: ParsedEducation[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = clean(lines[i]);
        const deg = DEGREES.find(([re]) => re.test(line));
        if (!deg) continue;
        // Neighbouring lines count only when they are not another degree's line
        const next = clean(lines[i + 1] ?? "");
        const prevLine = clean(lines[i - 1] ?? "");
        const free = (l: string) => l && !DEGREES.some(([re]) => re.test(l)) && !RANGE_RE.test(l);
        const window = [line, ...(free(next) ? [next] : []), ...(free(prevLine) ? [prevLine] : [])];
        const PARTS = /\s*[|–—]\s*|\s+-\s+| {2,}|,\s*(?=[A-Z])/;
        const inst = window.find((l) => INSTITUTION_RE.test(l.split(PARTS).filter((p) => !deg[0].test(p)).join(" ")));
        const years = (line.match(/\b(19[6-9]\d|20[0-4]\d)\b/g) ?? (free(next) ? next.match(/\b(19[6-9]\d|20[0-4]\d)\b/g) : null));
        // Keep the specialisation the resume gives, e.g. "B.Tech in Computer Science"
        const degreeText = line.split(PARTS).find((p) => deg[0].test(p)) ?? deg[1];
        let institution: string | null = null;
        if (inst) {
            const part = inst.split(PARTS).find((p) => INSTITUTION_RE.test(p) && !deg[0].test(p)) ?? inst;
            institution = part.replace(/\b(19|20)\d{2}\b.*$/, "").replace(/[,\-–(]+\s*$/, "").trim() || null;
        }
        out.push({ degree: degreeText.replace(/\b(19|20)\d{2}\b.*$/, "").replace(/[,\-–(]+\s*$/, "").trim() || deg[1], institution, year: years ? years[years.length - 1] : null });
    }
    // One entry per degree line
    return out.filter((e, i) => out.findIndex((x) => x.degree === e.degree && x.institution === e.institution) === i).slice(0, 6);
}

function highestOf(education: ParsedEducation[]): string | null {
    let best: [string, number] | null = null;
    for (const e of education) {
        const d = DEGREES.find(([re]) => re.test(e.degree ?? ""));
        if (d && (!best || d[2] > best[1])) best = [d[1], d[2]];
    }
    return best?.[0] ?? null;
}

// ─── Notice period & CTC (only when written in the resume) ────

function noticeDays(text: string): number | null {
    const m = text.match(/notice\s*period\s*(?:of|is|[:\-])?\s*(immediate(?:ly)?|serving[^.\n]{0,30}|(\d{1,3})\s*(days?|weeks?|months?))/i);
    if (m) {
        if (/^immediate/i.test(m[1])) return 0;
        if (m[2]) {
            const n = Number(m[2]);
            return /month/i.test(m[3]) ? n * 30 : /week/i.test(m[3]) ? n * 7 : n;
        }
        const s = m[1].match(/(\d{1,3})\s*(days?|weeks?|months?)/i);
        if (s) return /month/i.test(s[2]) ? Number(s[1]) * 30 : /week/i.test(s[2]) ? Number(s[1]) * 7 : Number(s[1]);
    }
    if (/\bimmediate(ly)?\s+(joiner|joining|available)\b/i.test(text)) return 0;
    return null;
}

function ctcLpa(text: string, kind: "current" | "expected"): number | null {
    const label = kind === "current" ? "(?:current|present|existing)\\s*(?:ctc|salary|package|compensation)|\\bctc\\b(?!\\s*expected)" : "(?:expected|desired)\\s*(?:ctc|salary|package|compensation)";
    const m = text.match(new RegExp(`(?:${label})\\s*(?:is|of)?\\s*[:\\-]?\\s*(?:inr|rs\\.?|₹)?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(lpa|lakhs?|lacs?|l\\b|cr|crores?|k\\b|per\\s*annum|p\\.?a\\.?)?`, "i"));
    if (!m) return null;
    let v = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(v) || v <= 0) return null;
    const unit = (m[2] ?? "").toLowerCase();
    if (/^cr/.test(unit)) v *= 100;
    else if (unit === "k") v = v / 100; // thousands → lakhs
    else if (!/^(lpa|lakh|lac|l)/.test(unit) && v >= 10000) v = v / 100000; // rupees per annum
    return Math.round(v * 100) / 100;
}

// ─── Main ─────────────────────────────────────────────────────

export function parseResumeText(raw: string): ParsedResume {
    const text = raw.replace(/\r/g, "").replace(/ /g, " ");
    const lines = text.split("\n").map((l) => l.replace(/\s+$/g, "")).filter((l) => clean(l));
    const sec = splitSections(lines);
    const all = lines.join("\n");

    const email = (all.match(EMAIL_RE) ?? []).map((e) => e.replace(/[.,;]+$/, "")).find(isEmail)?.toLowerCase() ?? null;
    const contactZone = [...sec.header, ...(sec.personal ?? [])].join("\n");
    const phone = findPhone(contactZone) ?? findPhone(all.replace(RANGE_RE, " "));
    const urls = findUrls(all);

    const work = parseExperience(sec.experience ?? []);
    // Only a job marked Present / till date is "current"; a past job is never promoted
    const currentJob = work.find((w) => w.current) ?? null;
    const rangeMonths = monthsFromRanges(work);
    const stated = statedYears([...(sec.summary ?? []), ...sec.header].join(" ") || all, "total") ?? statedYears(all, "total");
    const total = stated ?? (rangeMonths !== null ? Math.round((rangeMonths / 12) * 10) / 10 : null);

    // "Skills: A, B, C" written inline anywhere counts as a skills list too
    const inlineSkills = lines
        .map((l) => l.match(/^\s*(?:key |technical |core |it |primary )?skills?(?: set)?\s*[:\-–]\s*(.{2,})$/i)?.[1])
        .filter((x): x is string => !!x);
    const skillLines = [...(sec.skills ?? []), ...inlineSkills];
    const skillList = uniqCi(listItems(skillLines));
    const programmingLanguages = uniq([
        ...dictMatch(all, LANGUAGES),
        // single-letter languages only from an explicit skills list
        ...listItems(skillLines).filter((s) => s === "C" || s === "R"),
    ]);
    const frameworks = dictMatch(all, FRAMEWORKS);
    const tools = dictMatch(all, TOOLS);
    const skills = uniqCi([...skillList, ...programmingLanguages, ...frameworks, ...tools]).slice(0, 40);

    const education = parseEducation(sec.education ?? lines.filter((l) => DEGREES.some(([re]) => re.test(l))));
    const certifications = uniqCi(
        (sec.certifications ?? []).map((l) => clean(l).replace(/^[-–—\s]+/, "")).filter((l) => l.length >= 4 && l.length <= 140),
    ).slice(0, 15);
    const projects = uniqCi(
        (sec.projects ?? [])
            .map((l) => clean(l))
            // Project titles: short lines, often "Title | Tech" or "Title:" (descriptions are long sentences)
            .filter((l) => l.length >= 3 && l.length <= 80 && !/^(tech|technologies|tools|role|description|responsibilit)/i.test(l) && !/\.$/.test(l))
            .map((l) => l.split(/\s*[|:–—]\s*/)[0]),
    ).slice(0, 10);

    const prev = work.filter((w) => w !== currentJob);
    const domains = DOMAINS.filter(([, re]) => re.test(all)).map(([d]) => d);

    return {
        name: findName(sec.header.length ? sec.header : lines, email),
        email,
        phone,
        location: findLocation(lines, sec.header, sec.personal ?? []),
        ...urls,
        currentCompany: currentJob?.company ?? null,
        currentDesignation: currentJob?.designation ?? null,
        totalExperienceYears: total,
        totalExperienceSource: stated !== null ? "STATED" : total !== null ? "FROM_DATES" : null,
        relevantExperienceYears: statedYears(all, "relevant"),
        previousCompanies: uniqCi(prev.map((w) => w.company).filter((c): c is string => !!c)),
        previousDesignations: uniqCi(prev.map((w) => w.designation).filter((c): c is string => !!c)),
        workExperience: work.slice(0, 15),
        skills,
        programmingLanguages,
        frameworks,
        tools,
        domains,
        highestQualification: highestOf(education),
        education,
        certifications,
        projects,
        noticePeriodDays: noticeDays(all),
        currentCtcLpa: ctcLpa(all, "current"),
        expectedCtcLpa: ctcLpa(all, "expected"),
    };
}
