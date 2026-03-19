import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface ReportSection {
  title: string;
  body: string;
}

export interface MigrationReport {
  title: string;
  sections: ReportSection[];
}

export function renderReportMd(report: MigrationReport): string {
  const lines: string[] = [];
  lines.push(`# ${report.title}`);
  lines.push("");
  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.body.trimEnd());
    lines.push("");
  }
  return lines.join("\n");
}

export async function writeReportMd(path: string, report: MigrationReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderReportMd(report), "utf8");
}

