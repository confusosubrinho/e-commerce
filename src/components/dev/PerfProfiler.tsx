import { Profiler, type ReactNode } from 'react';

type CommitPhase = 'mount' | 'update' | 'nested-update';

type PerfEntry = {
  id: string;
  commits: number;
  mounts: number;
  updates: number;
  nestedUpdates: number;
  slowCommits: number;
  totalActualDuration: number;
  avgActualDuration: number;
  maxActualDuration: number;
  totalBaseDuration: number;
  avgBaseDuration: number;
  maxBaseDuration: number;
  lastActualDuration: number;
  lastCommitAt: number;
};

type PerfStore = Record<string, PerfEntry>;

type PerfProfilerProps = {
  id: string;
  children: ReactNode;
  slowThresholdMs?: number;
};

declare global {
  interface Window {
    __ecomPerfStats?: PerfStore;
    __printEcomPerfReport?: () => void;
    __resetEcomPerfReport?: () => void;
  }
}

const PERF_QUERY_PARAM = 'perf';
const PERF_STORAGE_KEY = '__ECOM_PERF_ENABLED';

function isPerfEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const forceOn = params.get(PERF_QUERY_PARAM) === '1';
  const forceOff = params.get(PERF_QUERY_PARAM) === '0';

  if (forceOn) {
    window.localStorage.setItem(PERF_STORAGE_KEY, '1');
    return true;
  }
  if (forceOff) {
    window.localStorage.removeItem(PERF_STORAGE_KEY);
    return false;
  }

  return window.localStorage.getItem(PERF_STORAGE_KEY) === '1';
}

function ensurePerfStore(): PerfStore {
  if (typeof window === 'undefined') return {};

  window.__ecomPerfStats = window.__ecomPerfStats || {};

  if (!window.__printEcomPerfReport) {
    window.__printEcomPerfReport = () => {
      const rows = Object.values(window.__ecomPerfStats || {})
        .sort((a, b) => b.totalActualDuration - a.totalActualDuration)
        .map((entry) => ({
          component: entry.id,
          commits: entry.commits,
          slowCommits: entry.slowCommits,
          totalMs: Number(entry.totalActualDuration.toFixed(2)),
          avgMs: Number(entry.avgActualDuration.toFixed(2)),
          maxMs: Number(entry.maxActualDuration.toFixed(2)),
          avgBaseMs: Number(entry.avgBaseDuration.toFixed(2)),
          maxBaseMs: Number(entry.maxBaseDuration.toFixed(2)),
          mounts: entry.mounts,
          updates: entry.updates,
          nestedUpdates: entry.nestedUpdates,
          lastCommitAt: new Date(entry.lastCommitAt).toISOString(),
        }));

      console.table(rows);
      console.info('[perf] Use window.__resetEcomPerfReport() para limpar os dados.');
    };
  }

  if (!window.__resetEcomPerfReport) {
    window.__resetEcomPerfReport = () => {
      window.__ecomPerfStats = {};
      console.info('[perf] Relatorio de performance limpo.');
    };
  }

  return window.__ecomPerfStats;
}

function upsertPerfEntry(
  store: PerfStore,
  id: string,
  phase: CommitPhase,
  actualDuration: number,
  baseDuration: number,
  slowThresholdMs: number,
) {
  const current = store[id] || {
    id,
    commits: 0,
    mounts: 0,
    updates: 0,
    nestedUpdates: 0,
    slowCommits: 0,
    totalActualDuration: 0,
    avgActualDuration: 0,
    maxActualDuration: 0,
    totalBaseDuration: 0,
    avgBaseDuration: 0,
    maxBaseDuration: 0,
    lastActualDuration: 0,
    lastCommitAt: 0,
  };

  current.commits += 1;
  if (phase === 'mount') current.mounts += 1;
  if (phase === 'update') current.updates += 1;
  if (phase === 'nested-update') current.nestedUpdates += 1;
  if (actualDuration >= slowThresholdMs) current.slowCommits += 1;

  current.totalActualDuration += actualDuration;
  current.avgActualDuration = current.totalActualDuration / current.commits;
  current.maxActualDuration = Math.max(current.maxActualDuration, actualDuration);

  current.totalBaseDuration += baseDuration;
  current.avgBaseDuration = current.totalBaseDuration / current.commits;
  current.maxBaseDuration = Math.max(current.maxBaseDuration, baseDuration);

  current.lastActualDuration = actualDuration;
  current.lastCommitAt = Date.now();

  store[id] = current;
}

export function PerfProfiler({ id, children, slowThresholdMs = 16 }: PerfProfilerProps) {
  if (!isPerfEnabled()) return <>{children}</>;

  return (
    <Profiler
      id={id}
      onRender={(profilerId, phase, actualDuration, baseDuration) => {
        if (typeof window === 'undefined') return;

        const commitPhase = phase as CommitPhase;
        const store = ensurePerfStore();
        upsertPerfEntry(store, profilerId, commitPhase, actualDuration, baseDuration, slowThresholdMs);

        if (actualDuration >= slowThresholdMs) {
          const mark = `slow-render:${profilerId}:${Date.now()}`;
          if (typeof window.performance?.mark === 'function') {
            window.performance.mark(mark);
          }
          console.warn(
            `[perf] ${profilerId} ${commitPhase} lento: ${actualDuration.toFixed(2)}ms (base ${baseDuration.toFixed(2)}ms)`,
          );
        }
      }}
    >
      {children}
    </Profiler>
  );
}
