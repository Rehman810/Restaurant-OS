import fs from "fs";
import path from "path";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { isTestUserRecord } from "../test-users";
import { fetchUserHistoryCounts, historyTotal } from "./history";

export type TestStaffReportRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  isTest: boolean;
  branchNames: string;
  createdAt: string;
  lastLoginAt: string;
  historyTotal: number;
  flaggedByPattern: boolean;
};

export type TestStaffReportSummary = {
  scannedAt: string;
  totalUsers: number;
  testLikeUsers: number;
  byRole: Record<string, number>;
  byEmailDomain: Record<string, number>;
  withHistory: number;
  withoutHistory: number;
  activeTestAdmins: number;
};

function emailDomain(email: string): string {
  const parts = email.split("@");
  return parts.length > 1 ? parts[1].toLowerCase() : "(none)";
}

function csvEscape(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildTestStaffReport(): Promise<{
  summary: TestStaffReportSummary;
  rows: TestStaffReportRow[];
}> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isTest: true,
      createdAt: true,
      lastLoginAt: true,
      totpEnabled: true,
      branchMembers: { select: { branch: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const testLike = users.filter((u) => isTestUserRecord(u));
  const byRole: Record<string, number> = {};
  const byEmailDomain: Record<string, number> = {};
  let withHistory = 0;
  let withoutHistory = 0;
  let activeTestAdmins = 0;

  const rows: TestStaffReportRow[] = [];
  for (const u of testLike) {
    byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    const domain = emailDomain(u.email);
    byEmailDomain[domain] = (byEmailDomain[domain] ?? 0) + 1;
    if (u.role === Role.ADMIN && u.isActive) activeTestAdmins += 1;

    const counts = await fetchUserHistoryCounts(u.id);
    const total = historyTotal(counts);
    if (total > 0) withHistory += 1;
    else withoutHistory += 1;

    rows.push({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      isTest: u.isTest,
      branchNames: u.branchMembers.map((m) => m.branch.name).join("; ") || "(none)",
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? "",
      historyTotal: total,
      flaggedByPattern: !u.isTest && isTestUserRecord({ email: u.email, isTest: false }),
    });
  }

  const summary: TestStaffReportSummary = {
    scannedAt: new Date().toISOString(),
    totalUsers: users.length,
    testLikeUsers: testLike.length,
    byRole,
    byEmailDomain,
    withHistory,
    withoutHistory,
    activeTestAdmins,
  };

  return { summary, rows };
}

export function formatSummaryTable(summary: TestStaffReportSummary): string {
  const lines = [
    `Scanned at: ${summary.scannedAt}`,
    `Total users in DB: ${summary.totalUsers}`,
    `Test-like users: ${summary.testLikeUsers}`,
    `  With history: ${summary.withHistory}`,
    `  Without history: ${summary.withoutHistory}`,
    `  Active test ADMIN accounts: ${summary.activeTestAdmins}`,
    "",
    "By role (test-like):",
    ...Object.entries(summary.byRole)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([role, n]) => `  ${role}: ${n}`),
    "",
    "By email domain (test-like):",
    ...Object.entries(summary.byEmailDomain)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([domain, n]) => `  ${domain}: ${n}`),
  ];
  return lines.join("\n");
}

export function rowsToCsv(rows: TestStaffReportRow[]): string {
  const header = [
    "id",
    "email",
    "name",
    "role",
    "isActive",
    "isTest",
    "branchNames",
    "createdAt",
    "lastLoginAt",
    "historyTotal",
    "flaggedByPattern",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.id),
        csvEscape(r.email),
        csvEscape(r.name),
        csvEscape(r.role),
        csvEscape(r.isActive),
        csvEscape(r.isTest),
        csvEscape(r.branchNames),
        csvEscape(r.createdAt),
        csvEscape(r.lastLoginAt),
        csvEscape(r.historyTotal),
        csvEscape(r.flaggedByPattern),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export async function writeTestStaffReportFiles(repoRoot: string): Promise<{
  summaryPath: string;
  csvPath: string;
  summary: TestStaffReportSummary;
}> {
  const { summary, rows } = await buildTestStaffReport();
  const dir = path.join(repoRoot, "docs", "reports");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = summary.scannedAt.replace(/[:.]/g, "-");
  const summaryPath = path.join(dir, `test-staff-summary-${stamp}.txt`);
  const csvPath = path.join(dir, `test-staff-${stamp}.csv`);
  fs.writeFileSync(summaryPath, formatSummaryTable(summary) + "\n\n", "utf8");
  fs.writeFileSync(csvPath, rowsToCsv(rows), "utf8");
  return { summaryPath, csvPath, summary };
}
