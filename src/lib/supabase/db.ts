import { createAdminClient } from "./admin";
import * as mock from "../mock/data";
import type { JobRequisition, Client, UserRole, ClientStatus, JobStatus } from "../types";

const supabase = createAdminClient();

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
  try {
    const { error } = await supabase.from("audit_logs").insert({
      org_id: entry.orgId,
      user_id: entry.actorUserId ?? null,
      action: entry.action,
      entity_type: entry.entity,
      entity_id: entry.entityId ?? null,
      details: { role: entry.actorRole, detail: entry.detail },
    });
    if (error) throw error;
  } catch {
    mock.addAudit({
      orgId: entry.orgId,
      actorUserId: entry.actorUserId || "usr-sa",
      actorRole: (entry.actorRole || "SUPER_ADMIN") as UserRole,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId || "",
      detail: entry.detail,
    });
  }
}

// ─────────────────── CLIENTS / COMPANIES ───────────────────
export async function getClientsFromDb(orgId: string): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) throw error;

    return data.map((d) => ({
      id: d.id,
      orgId: d.org_id,
      companyName: d.company_name || d.name,
      industry: d.industry || "Other",
      website: d.website,
      contactPerson: d.contact_person || "Contact",
      contactEmail: d.contact_email || "",
      contactPhone: d.contact_phone || "",
      address: d.address || d.location,
      status: (d.status || "ACTIVE") as ClientStatus,
      agreementUrl: null,
      commissionRate: Number(d.commission_rate) || 8.33,
      creditDays: Number(d.credit_days) || 30,
      accountManagerId: d.account_manager_id,
      estimatedValue: d.estimated_value || "—",
      notes: d.notes,
      createdAt: d.created_at,
      updatedAt: d.updated_at || d.created_at,
    }));
  } catch {
    return mock.clients.filter((c) => c.orgId === orgId);
  }
}

export async function createClientInDb(client: Client): Promise<Client> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .insert({
        id: client.id,
        org_id: client.orgId,
        name: client.companyName,
        company_name: client.companyName,
        industry: client.industry,
        website: client.website,
        contact_person: client.contactPerson,
        contact_email: client.contactEmail,
        contact_phone: client.contactPhone,
        address: client.address,
        status: client.status,
        commission_rate: client.commissionRate,
        credit_days: client.creditDays,
        account_manager_id: client.accountManagerId,
        estimated_value: client.estimatedValue,
        notes: client.notes,
      })
      .select()
      .single();

    if (error || !data) throw error;
    return client;
  } catch {
    mock.clients.push(client);
    return client;
  }
}

// ─────────────────── JOBS ───────────────────
export async function getJobsFromDb(orgId: string): Promise<JobRequisition[]> {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) throw error;

    return data.map((j) => ({
      id: j.id,
      orgId: j.org_id,
      clientId: j.company_id,
      title: j.title,
      department: j.department || "General",
      location: j.location || "",
      employmentType: j.employment_type || "FULL_TIME",
      priority: j.priority || "MEDIUM",
      openings: j.openings || 1,
      filled: j.filled || 0,
      salaryMinLpa: Number(j.salary_min_lpa || (j.salary_min ? j.salary_min / 100000 : 0)),
      salaryMaxLpa: Number(j.salary_max_lpa || (j.salary_max ? j.salary_max / 100000 : 0)),
      experienceMinYears: Number(j.experience_min_years || j.exp_min || 0),
      experienceMaxYears: Number(j.experience_max_years || j.exp_max || 0),
      skills: Array.isArray(j.skills) ? j.skills : [],
      description: j.description || "",
      status: (j.status === "published" ? "APPROVED" : j.status || "APPROVED") as JobStatus,
      requestedById: j.recruiter_id,
      approvedById: j.recruiter_id,
      assignedTas: [],
      targetCloseDate: j.target_close_date,
      createdAt: j.created_at,
      updatedAt: j.updated_at || j.created_at,
    }));
  } catch {
    return mock.jobs.filter((j) => j.orgId === orgId);
  }
}

export async function createJobInDb(job: JobRequisition): Promise<JobRequisition> {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        id: job.id,
        org_id: job.orgId,
        company_id: job.clientId,
        title: job.title,
        department: job.department,
        location: job.location,
        employment_type: job.employmentType,
        priority: job.priority,
        openings: job.openings,
        filled: job.filled,
        salary_min_lpa: job.salaryMinLpa,
        salary_max_lpa: job.salaryMaxLpa,
        salary_min: job.salaryMinLpa * 100000,
        salary_max: job.salaryMaxLpa * 100000,
        experience_min_years: job.experienceMinYears,
        experience_max_years: job.experienceMaxYears,
        exp_min: job.experienceMinYears,
        exp_max: job.experienceMaxYears,
        skills: job.skills,
        description: job.description,
        status: job.status === "APPROVED" ? "published" : "draft",
        recruiter_id: job.requestedById,
      })
      .select()
      .single();

    if (error || !data) throw error;
    return job;
  } catch {
    mock.jobs.push(job);
    return job;
  }
}

export async function updateJobInDb(jobId: string, orgId: string, updates: Partial<JobRequisition>): Promise<boolean> {
  try {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.clientId !== undefined) payload.company_id = updates.clientId;
    if (updates.department !== undefined) payload.department = updates.department;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.employmentType !== undefined) payload.employment_type = updates.employmentType;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.openings !== undefined) payload.openings = Number(updates.openings);
    if (updates.salaryMinLpa !== undefined) {
      payload.salary_min_lpa = Number(updates.salaryMinLpa);
      payload.salary_min = Number(updates.salaryMinLpa) * 100000;
    }
    if (updates.salaryMaxLpa !== undefined) {
      payload.salary_max_lpa = Number(updates.salaryMaxLpa);
      payload.salary_max = Number(updates.salaryMaxLpa) * 100000;
    }
    if (updates.experienceMinYears !== undefined) {
      payload.experience_min_years = Number(updates.experienceMinYears);
      payload.exp_min = Number(updates.experienceMinYears);
    }
    if (updates.experienceMaxYears !== undefined) {
      payload.experience_max_years = Number(updates.experienceMaxYears);
      payload.exp_max = Number(updates.experienceMaxYears);
    }
    if (updates.skills !== undefined) payload.skills = updates.skills;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.status !== undefined) {
      payload.status = updates.status === "APPROVED" ? "published" : updates.status;
    }

    const { error } = await supabase
      .from("jobs")
      .update(payload)
      .eq("id", jobId)
      .eq("org_id", orgId);

    if (error) throw error;
    return true;
  } catch (err) {
    const idx = mock.jobs.findIndex((j) => j.id === jobId && j.orgId === orgId);
    if (idx !== -1) {
      mock.jobs[idx] = { ...mock.jobs[idx], ...updates, updatedAt: new Date().toISOString() };
      return true;
    }
    return false;
  }
}

export async function deleteJobFromDb(jobId: string, orgId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", jobId)
      .eq("org_id", orgId);

    if (error) throw error;
    return true;
  } catch {
    const idx = mock.jobs.findIndex((j) => j.id === jobId && j.orgId === orgId);
    if (idx !== -1) {
      mock.jobs.splice(idx, 1);
      return true;
    }
    return false;
  }
}
