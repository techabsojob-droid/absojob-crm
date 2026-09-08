import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

let envContent = "";
if (existsSync(".env")) {
  envContent = readFileSync(".env", "utf8");
}

const envVars = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].trim();
  }
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("Seeding applications & activities...");

const APPLICATIONS = [
  {
    id: "app_001",
    org_id: "org_default",
    candidate_id: "cand_001",
    job_id: "job_101",
    stage: "SOURCED",
    status: "IN_PROGRESS",
    match_score: 92,
  },
  {
    id: "app_002",
    org_id: "org_default",
    candidate_id: "cand_002",
    job_id: "job_102",
    stage: "SCREENING",
    status: "IN_PROGRESS",
    match_score: 88,
  },
  {
    id: "app_003",
    org_id: "org_default",
    candidate_id: "cand_003",
    job_id: "job_104",
    stage: "TECH_ROUND",
    status: "IN_PROGRESS",
    match_score: 95,
  }
];

const INTERNSHIPS = [
  {
    id: "int_001",
    org_id: "org_default",
    company_id: "cli_1",
    title: "Backend Development Intern (Node.js)",
    location: "Bangalore",
    mode: "hybrid",
    duration: "6 Months",
    stipend_min: 25000,
    stipend_max: 35000,
    skills: ["Node.js", "Express", "TypeScript", "PostgreSQL"],
    category: "Software Development",
    description: "Work on core backend services and microservices.",
    openings: 5,
    ppo_available: true,
    status: "published"
  },
  {
    id: "int_002",
    org_id: "org_default",
    company_id: "cli_4",
    title: "AI/ML Research Intern",
    location: "Hyderabad",
    mode: "remote",
    duration: "3 Months",
    stipend_min: 30000,
    stipend_max: 45000,
    skills: ["Python", "PyTorch", "Transformers", "NLP"],
    category: "Data Science",
    description: "Research and implement modern transformer models and agents.",
    openings: 3,
    ppo_available: true,
    status: "published"
  }
];

const AUDIT_LOGS = [
  {
    id: "aud_001",
    org_id: "org_default",
    user_id: "usr_admin_1",
    action: "SYSTEM_INITIALIZED",
    entity_type: "SYSTEM",
    entity_id: "sys_init",
    details: { message: "Supabase database schema migrated and initial catalogue seeded." }
  }
];

async function run() {
  await supabase.from("applications").upsert(APPLICATIONS, { onConflict: "id" });
  await supabase.from("internships").upsert(INTERNSHIPS, { onConflict: "id" });
  await supabase.from("audit_logs").upsert(AUDIT_LOGS, { onConflict: "id" });
  console.log("✅ Applications, Internships & Audit logs seeded successfully!");
}

run();
