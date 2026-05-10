import { atom } from "nanostores";

export type JobRecord = {
  id: string;
  name: string;
  app: string;
  progress: number;
  state: "running" | "done" | "failed";
  detail?: string;
  startedAt: number;
};

export const jobs = atom<JobRecord[]>([]);

export function startJob(name: string, app = "system", detail = "") {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const job: JobRecord = { id, name, app, detail, progress: 3, state: "running", startedAt: Date.now() };
  jobs.set([job, ...jobs.get()].slice(0, 30));
  return id;
}

export function updateJob(id: string, patch: Partial<JobRecord>) {
  jobs.set(jobs.get().map((job) => job.id === id ? { ...job, ...patch } : job));
}

export function finishJob(id: string, detail = "complete") {
  updateJob(id, { progress: 100, state: "done", detail });
}

export function failJob(id: string, detail = "failed") {
  updateJob(id, { state: "failed", detail });
}
