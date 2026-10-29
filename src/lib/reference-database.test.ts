import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0015_reference_dataset_tables.sql", "utf8");
const tables = ["reference_datasets", "reference_files", "reference_subjects", "reference_features"];
const adminCheck = "public.has_role(auth.uid(), 'admin'::public.app_role)";
const researcherCheck = "public.has_role(auth.uid(), 'researcher'::public.app_role)";

function policy(table: string, action: string) {
  const match = sql.match(new RegExp(`CREATE POLICY ${table}_${action} ON public\\.${table}([\\s\\S]*?);`));
  if (!match) throw new Error(`Missing ${table} ${action} policy`);
  return match[1].replace(/\s+/g, " ").trim();
}

describe("reference database access", () => {
  for (const table of tables) {
    it(`${table}: only signed-in researchers/admins can read`, () => {
      expect(policy(table, "read")).toBe(`FOR SELECT TO authenticated USING (${researcherCheck} OR ${adminCheck})`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated;`);
      expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON public\\.${table} TO anon\\b`));
    });
    it(`${table}: only admins can insert`, () => {
      expect(policy(table, "insert")).toBe(`FOR INSERT TO authenticated WITH CHECK (${adminCheck})`);
    });
    it(`${table}: only admins can update existing and replacement rows`, () => {
      expect(policy(table, "update")).toBe(`FOR UPDATE TO authenticated USING (${adminCheck}) WITH CHECK (${adminCheck})`);
    });
    it(`${table}: only admins can delete`, () => {
      expect(policy(table, "delete")).toBe(`FOR DELETE TO authenticated USING (${adminCheck})`);
    });
  }
  it("numeric subject/feature columns and checksum matching remain nullable", () => {
    for (const table of ["reference_subjects", "reference_features"]) {
      const block = sql.match(new RegExp(`CREATE TABLE public\\.${table} \\(([\\s\\S]*?)\\n\\);`))?.[1];
      if (!block) throw new Error(`Missing ${table}`);
      const numericColumns = block.split("\n").filter(line => /\b(numeric|integer|bigint)\b/.test(line));
      expect(numericColumns.length).toBeGreaterThan(10);
      for (const line of numericColumns) expect(line).not.toContain("NOT NULL");
    }
    expect(sql).toMatch(/matches_official_checksum boolean\s*\n/);
  });
  it("allows only estimated, unreliable and failed feature status", () => {
    expect(sql).toContain("CHECK (status IN ('estimated', 'unreliable', 'failed'))");
  });
  it("does not alter or drop existing tables", () => {
    expect([...sql.matchAll(/ALTER TABLE public\.(\w+)/g)].map(match => match[1]).sort()).toEqual([...tables].sort());
    expect(sql).not.toMatch(/\bDROP\b|public\.profiles/);
  });
});