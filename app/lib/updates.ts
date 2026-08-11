export type Semver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

export type ReleaseInfo = {
  version: string;
  title: string;
  notes: string;
  url: string;
  publishedAt: string | null;
};

export type UpdateCheck =
  | { status: "current"; latest: ReleaseInfo }
  | { status: "available"; latest: ReleaseInfo }
  | { status: "offline"; latest: null }
  | { status: "error"; latest: null; message: string };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const semverPattern = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

export const parseSemver = (value: string): Semver | null => {
  const match = value.trim().match(semverPattern);
  if (!match) return null;
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch, prerelease: match[4] ?? null };
};

const comparePrerelease = (left: string | null, right: string | null) => {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index];
    const b = rightParts[index];
    if (a === b) continue;
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const aNumber = /^\d+$/.test(a) ? Number(a) : null;
    const bNumber = /^\d+$/.test(b) ? Number(b) : null;
    if (aNumber !== null && bNumber !== null) return aNumber > bNumber ? 1 : -1;
    if (aNumber !== null) return -1;
    if (bNumber !== null) return 1;
    return a.localeCompare(b);
  }
  return 0;
};

/** Returns null when either version is not valid semantic versioning. */
export const compareVersions = (left: string, right: string): number | null => {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
};

type GitHubRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
};

export const releaseFromGitHub = (payload: GitHubRelease): ReleaseInfo | null => {
  if (payload.draft === true || payload.prerelease === true || typeof payload.tag_name !== "string") return null;
  const version = payload.tag_name.replace(/^v/i, "");
  if (!parseSemver(version)) return null;
  return {
    version,
    title: typeof payload.name === "string" && payload.name.trim() ? payload.name : `ImageLab ${version}`,
    notes: typeof payload.body === "string" ? payload.body.trim() : "",
    url: typeof payload.html_url === "string" ? payload.html_url : "",
    publishedAt: typeof payload.published_at === "string" ? payload.published_at : null,
  };
};

export async function checkForUpdates({
  currentVersion,
  releaseUrl,
  fetcher = fetch,
  online = typeof navigator === "undefined" ? true : navigator.onLine,
}: {
  currentVersion: string;
  releaseUrl: string;
  fetcher?: Fetcher;
  online?: boolean;
}): Promise<UpdateCheck> {
  if (!online) return { status: "offline", latest: null };
  try {
    const response = await fetcher(releaseUrl, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Release lookup returned ${response.status}.`);
    const latest = releaseFromGitHub(await response.json() as GitHubRelease);
    if (!latest) throw new Error("The latest stable release metadata is invalid.");
    const comparison = compareVersions(latest.version, currentVersion);
    if (comparison === null) throw new Error("The running version metadata is invalid.");
    return comparison > 0 ? { status: "available", latest } : { status: "current", latest };
  } catch (error) {
    return {
      status: "error",
      latest: null,
      message: error instanceof Error ? error.message : "The update service could not be reached.",
    };
  }
}

export const releaseSummary = (notes: string, maximum = 180) => {
  const plain = notes.replace(/[#*_>`-]/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > maximum ? `${plain.slice(0, maximum - 1).trimEnd()}…` : plain;
};

