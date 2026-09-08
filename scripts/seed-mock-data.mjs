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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("🚀 Starting data migration to Supabase:", supabaseUrl);

const COMPANIES = [
  { id: "cli_1", name: "TechNova Solutions", company_name: "TechNova Solutions", industry: "IT & Software", location: "Bangalore", address: "Tech Park, Whitefield, Bangalore", size: "250-500", rating: 4.8, description: "Leading enterprise SaaS and cloud infrastructure software provider.", website: "https://technova.example.com", status: "ACTIVE" },
  { id: "cli_2", name: "MediCare Plus", company_name: "MediCare Plus", industry: "Healthcare", location: "Mumbai", address: "Bandra Kurla Complex, Mumbai", size: "500-1000", rating: 4.6, description: "Nationwide hospital chain and digital healthcare provider.", website: "https://medicare.example.com", status: "ACTIVE" },
  { id: "cli_3", name: "FinFlow Global", company_name: "FinFlow Global", industry: "Fintech", location: "Gurugram", address: "Cyber City, DLF Phase 2, Gurugram", size: "100-250", rating: 4.7, description: "Next-generation fintech payment gateways and lending APIs.", website: "https://finflow.example.com", status: "ACTIVE" },
  { id: "cli_4", name: "Zenithra Technologies", company_name: "Zenithra Technologies", industry: "AI & ML", location: "Hyderabad", address: "HITEC City, Hyderabad", size: "50-100", rating: 4.9, description: "AI research and computer vision product studio.", website: "https://zenithra.example.com", status: "ACTIVE" },
  { id: "cli_5", name: "Setu Payments", company_name: "Setu Payments", industry: "Banking & Financial Services", location: "Pune", address: "Kharadi IT Park, Pune", size: "200-500", rating: 4.5, description: "API infrastructure for modern open banking in India.", website: "https://setu.example.com", status: "ACTIVE" }
];

const JOBS = [
  { id: "job_101", org_id: "org_default", company_id: "cli_1", title: "Senior Backend Engineer (Node.js/Go)", department: "Engineering", location: "Bangalore", workplace_type: "hybrid", employment_type: "FULL_TIME", priority: "HIGH", openings: 3, salary_min_lpa: 18, salary_max_lpa: 28, experience_min_years: 4, experience_max_years: 8, skills: ["Node.js", "TypeScript", "Go", "PostgreSQL", "Kafka", "Docker"], description: "We are looking for a Senior Backend Engineer to lead high-throughput microservices architecture.", status: "published", featured: true },
  { id: "job_102", org_id: "org_default", company_id: "cli_1", title: "Frontend Lead (React/Next.js)", department: "Engineering", location: "Remote", workplace_type: "remote", employment_type: "FULL_TIME", priority: "MEDIUM", openings: 2, salary_min_lpa: 20, salary_max_lpa: 32, experience_min_years: 5, experience_max_years: 9, skills: ["React", "Next.js", "TypeScript", "Tailwind CSS", "GraphQL"], description: "Lead our frontend team building enterprise portal experiences.", status: "published", featured: true },
  { id: "job_103", org_id: "org_default", company_id: "cli_3", title: "Product Manager - Fintech Core", department: "Product", location: "Gurugram", workplace_type: "hybrid", employment_type: "FULL_TIME", priority: "URGENT", openings: 1, salary_min_lpa: 22, salary_max_lpa: 35, experience_min_years: 4, experience_max_years: 7, skills: ["Product Strategy", "Fintech", "UPI", "Roadmapping", "SQL", "Agile"], description: "Drive consumer payments and checkout experiences.", status: "published", urgent: true },
  { id: "job_104", org_id: "org_default", company_id: "cli_4", title: "Machine Learning Engineer (LLMs & Vision)", department: "AI Lab", location: "Hyderabad", workplace_type: "hybrid", employment_type: "FULL_TIME", priority: "HIGH", openings: 2, salary_min_lpa: 24, salary_max_lpa: 40, experience_min_years: 3, experience_max_years: 6, skills: ["Python", "PyTorch", "HuggingFace", "RAG", "CUDA", "FastAPI"], description: "Build state-of-the-art vision and LLM generative applications.", status: "published", featured: true },
  { id: "job_105", org_id: "org_default", company_id: "cli_2", title: "Hospital Operations Manager", department: "Operations", location: "Mumbai", workplace_type: "onsite", employment_type: "FULL_TIME", priority: "MEDIUM", openings: 2, salary_min_lpa: 12, salary_max_lpa: 18, experience_min_years: 5, experience_max_years: 10, skills: ["Hospital Administration", "Healthcare Ops", "Vendor Management", "NABH Compliance"], description: "Manage day-to-day operations across our super-specialty hospital branch.", status: "published" }
];

const CANDIDATES = [
  { id: "cand_001", org_id: "org_default", name: "Sameer Khan", email: "sameer.khan@example.com", phone: "+91 98111 22334", title: "Senior Fullstack Developer", location: "Bangalore", experience: 5.5, current_company: "Cognizant", current_ctc: 16, expected_ctc: 24, notice_period: "15 Days", skills: ["Node.js", "React", "TypeScript", "PostgreSQL", "AWS"], stage: "SOURCED", resume_score: 92 },
  { id: "cand_002", org_id: "org_default", name: "Ananya Iyer", email: "ananya.iyer@example.com", phone: "+91 98222 33445", title: "Product Designer & UI/UX", location: "Mumbai", experience: 4.0, current_company: "Swiggy", current_ctc: 14, expected_ctc: 20, notice_period: "Immediate", skills: ["Figma", "Design Systems", "User Research", "Wireframing"], stage: "SCREENING", resume_score: 88 },
  { id: "cand_003", org_id: "org_default", name: "Rohan Verma", email: "rohan.verma@example.com", phone: "+91 98333 44556", title: "Lead Data Scientist", location: "Hyderabad", experience: 6.0, current_company: "Mu Sigma", current_ctc: 22, expected_ctc: 32, notice_period: "30 Days", skills: ["Python", "Machine Learning", "PyTorch", "NLP", "BigQuery"], stage: "TECH_ROUND", resume_score: 95 }
];

async function seed() {
  console.log("Checking Supabase connection and tables...");

  // 1. Companies
  const { error: compErr } = await supabase.from("companies").upsert(COMPANIES, { onConflict: "id" });
  if (compErr) {
    console.error("❌ Failed to seed companies:", compErr.message);
    console.log("\n⚠️ Supabase me schema create nahi hai. Pehle 'supabase-master-schema.sql' ko Supabase SQL Editor me run karein.");
    return;
  }
  console.log("✅ Seeded", COMPANIES.length, "Companies");

  // 2. Jobs
  const { error: jobErr } = await supabase.from("jobs").upsert(JOBS, { onConflict: "id" });
  if (jobErr) console.error("❌ Failed to seed jobs:", jobErr.message);
  else console.log("✅ Seeded", JOBS.length, "Jobs");

  // 3. Candidates
  const { error: candErr } = await supabase.from("candidates").upsert(CANDIDATES, { onConflict: "id" });
  if (candErr) console.error("❌ Failed to seed candidates:", candErr.message);
  else console.log("✅ Seeded", CANDIDATES.length, "Candidates");

  console.log("\n🎉 Seeding completed successfully! Ab CRM live Supabase data display karega.");
}

seed();
