import type { AnalysisResult, Fixture } from "./schemas";

export type JobStatus = "pending" | "running" | "done" | "error" | "cancelled";

export type Job = {
  id: string;
  fixture: Fixture;
  status: JobStatus;
  message: string;
  result?: AnalysisResult;
};

export const fixtureId = (f: Fixture) => `${f.competition}|${f.home}|${f.away}|${f.date}`;

/** Lance `worker` sur chaque élément, `concurrency` à la fois, tant que `shouldStop` reste faux. */
export async function runPool<T>(items: T[], concurrency: number, shouldStop: () => boolean, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lane = async () => {
    while (!shouldStop() && next < items.length) {
      await worker(items[next++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}
