/**
 * The three stores: the mark for the page reached by a link, what the page just left
 * reported, and how this history entry was left. Every access is guarded: storage can
 * be absent, full, or throw on read in a private window.
 *
 * Bundled into the head script only. The head script publishes what the kernel needs as
 * window.pageturn.store, so the page carries this code once.
 */
import { readSession, removeSession, writeSession } from "../common/session.ts";
import type { HistoryArrival, Json } from "../common/types.ts";

/** Raised whenever the store's functions or their records change shape. */
export const STORE_VERSION = 2;

const MARK_KEY = "pageturn";
// The key kept its first name: a tab open across an update still finds it.
const REPORT_KEY = "pageturn:left";
const MARK_FRESH_MS = 10_000;
const REPORT_FRESH_MS = 3_000;

/** For the page reached by a link. */
export interface Mark {
  move: string;
  data: Json;
  from: string;
  /** The page it was left for, its path and query: only that page takes it. */
  to?: string;
  at: number;
  /** The page left let the browser play the default move natively. */
  native?: true;
}

/** What the page just left said through whenLeft. */
export interface Report {
  from: string;
  at: number;
  data: Json;
  /** The report said there is nothing to return to. */
  none?: true;
}

/** How a history entry was left, kept in history.state. */
export interface Entry {
  move: string;
  to: string;
  returnAs: string;
  remember: Json;
}

const isFresh = (at: number, forMs: number): boolean => {
  const age = Date.now() - at;
  return age >= 0 && age < forMs;
};

/** Reads and deletes the mark; null when absent or stale. */
export function takeMark(): Mark | null {
  const mark = readSession<Mark>(MARK_KEY);
  removeSession(MARK_KEY);
  return mark && isFresh(mark.at, MARK_FRESH_MS) ? mark : null;
}

/** A page's address as a mark records it: its path and query. */
export const addressOf = (place: URL | Location): string =>
  place.pathname + place.search;

/** Writes the mark, with the address of the page it leads to. */
export const writeMark = (mark: Omit<Mark, "to">, to: URL): boolean =>
  writeSession(MARK_KEY, { ...mark, to: addressOf(to) });
export const forgetMark = (): void => removeSession(MARK_KEY);

export function readReport(): Report | null {
  const report = readSession<Report>(REPORT_KEY);
  return report && isFresh(report.at, REPORT_FRESH_MS) ? report : null;
}

export const writeReport = (report: Report): boolean =>
  writeSession(REPORT_KEY, report);

/** Whether sessionStorage takes a write: a private window may refuse it. */
export function canStore(): boolean {
  const probe = `${MARK_KEY}:probe`;
  const can = writeSession(probe, 0);
  removeSession(probe);
  return can;
}

function historyState(): Record<string, unknown> | null {
  const value: unknown = history.state;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function readEntry(): Entry | null {
  const entry = historyState()?.[MARK_KEY];
  return entry && typeof entry === "object" ? (entry as Entry) : null;
}

/**
 * Merges the record into the entry's state, or removes it when given null. A state that
 * is not a plain object (a router's array) is left as it is: no return is kept with it.
 * Nothing to remove, nothing is written: Safari limits how often a page may replace it.
 */
export function writeEntry(entry: Entry | null): void {
  const value: unknown = history.state;
  if (
    value !== null &&
    (typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype)
  ) {
    return;
  }
  const { [MARK_KEY]: kept, ...rest } = (value ?? {}) as Record<
    string,
    unknown
  >;
  if (!entry && !kept) return;
  try {
    history.replaceState(entry ? { ...rest, [MARK_KEY]: entry } : rest, "");
  } catch {}
}

/** The arrival a return by Back or Forward gives, when the entry and the page left agree. */
export function returnArrival(
  entry: Entry | null,
  report: Report | null,
): HistoryArrival | null {
  if (!entry?.returnAs || !report || report.none || report.from !== entry.to) {
    return null;
  }
  return {
    move: entry.returnAs,
    via: "history",
    from: report.from,
    data: null,
    remembered: entry.remember ?? null,
    reported: report.data ?? null,
  };
}

/** What the head script publishes for the kernel. */
export const store = {
  storeVersion: STORE_VERSION,
  writeMark,
  forgetMark,
  readReport,
  writeReport,
  canStore,
  readEntry,
  writeEntry,
  returnArrival,
};

export type Store = typeof store;
