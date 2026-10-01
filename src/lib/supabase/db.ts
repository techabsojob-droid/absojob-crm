import * as store from "../mock/data";
import type { JobRequisition, Client, UserRole } from "../types";

// Clients, jobs and audit entries live in the crm schema like every other
// collection: routes read/write the store and src/lib/db/sync.ts persists it.
// These helpers are kept so existing routes don't need to change.

// ─────────────────── AUDIT LOGS ───────────────────
export async function logAudit(entry: {
  orgId: string;
  actorUserId?: string | null;
  actorRole?: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail: string;
}) {
  store.addAudit({
    orgId: entry.orgId,
    actorUserId: entry.actorUserId || "usr-sa",
    actorRole: (entry.actorRole || "SUPER_ADMIN") as UserRole,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId || "",
    detail: entry.detail,
  });
}

// ─────────────────── CLIENTS / COMPANIES ───────────────────
export async function getClientsFromDb(orgId: string): Promise<Client[]> {
  return store.clients.filter((c) => c.orgId === orgId);
}

export async function createClientInDb(client: Client): Promise<Client> {
  store.clients.push(client);
  return client;
}

// ─────────────────── JOBS ───────────────────
export async function getJobsFromDb(orgId: string): Promise<JobRequisition[]> {
  return store.jobs.filter((j) => j.orgId === orgId);
}

export async function createJobInDb(job: JobRequisition): Promise<JobRequisition> {
  store.jobs.push(job);
  return job;
}

export async function updateJobInDb(jobId: string, orgId: string, updates: Partial<JobRequisition>): Promise<boolean> {
  const idx = store.jobs.findIndex((j) => j.id === jobId && j.orgId === orgId);
  if (idx === -1) return false;
  const cur = store.jobs[idx];
  const num = (v: unknown, fallback: number) => (v !== undefined ? Number(v) : fallback);
  store.jobs[idx] = {
    ...cur,
    ...updates,
    openings: num(updates.openings, cur.openings),
    filled: num(updates.filled, cur.filled),
    salaryMinLpa: num(updates.salaryMinLpa, cur.salaryMinLpa),
    salaryMaxLpa: num(updates.salaryMaxLpa, cur.salaryMaxLpa),
    experienceMinYears: num(updates.experienceMinYears, cur.experienceMinYears),
    experienceMaxYears: num(updates.experienceMaxYears, cur.experienceMaxYears),
    updatedAt: new Date().toISOString(),
  };
  return true;
}

export async function deleteJobFromDb(jobId: string, orgId: string): Promise<boolean> {
  const idx = store.jobs.findIndex((j) => j.id === jobId && j.orgId === orgId);
  if (idx === -1) return false;
  store.jobs.splice(idx, 1);
  return true;
}
