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

console.log("Connecting to Supabase at:", supabaseUrl);

async function checkAndSeed() {
  console.log("Checking Supabase tables...");

  const tables = [
    "organizations",
    "users",
    "companies",
    "jobs",
    "internships",
    "candidates",
    "applications"
  ];

  let missingTables = [];

  for (const t of tables) {
    const { error } = await supabase.from(t).select("*").limit(1);
    if (error) {
      console.log(`❌ Table '${t}' is missing: (${error.message})`);
      missingTables.push(t);
    } else {
      console.log(`✅ Table '${t}' is READY in Supabase!`);
    }
  }

  if (missingTables.length > 0) {
    console.log("\n=======================================================");
    console.log("⚠️ TABLES ABHI SUPABASE ME CREATE NAHI HAIN.");
    console.log("Supabase Dashboard me SQL Schema execute karein:");
    console.log("SQL Schema File: supabase-master-schema.sql");
    console.log("Supabase SQL Editor: https://supabase.com/dashboard/project/zjhdqjwwrmanjgxqhnjh/sql");
    console.log("=======================================================\n");
  } else {
    console.log("\n✅ All tables ready! Seeding initial data...");
  }
}

checkAndSeed();
