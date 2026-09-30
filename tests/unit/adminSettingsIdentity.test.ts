import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const actionsPath = new URL("../../src/features/admin/settings/settingsActions.ts", import.meta.url);
const migrationPath = new URL("../../supabase/migrations/012_identity_name_and_admin_email_workflow.sql", import.meta.url);

test("admin profile action derives its target and uses the authenticated client", async () => {
    const source = await readFile(actionsPath, "utf8");
    const signature = source.slice(source.indexOf("export async function updateAdminProfile"), source.indexOf("export interface AdminEmailChangeData"));
    assert.doesNotMatch(signature, /profileId:\s*string/);
    assert.match(signature, /checkAdminAuth\(\)/);
    assert.match(signature, /createSupabaseServerClient\(\)/);
    assert.doesNotMatch(signature, /createSupabaseServiceClient\(\)/);
    assert.doesNotMatch(signature, /full_name/);
});

test("email workflow derives roles and hashes random approval tokens", async () => {
    const source = await readFile(actionsPath, "utf8");
    assert.match(source, /randomBytes\(32\)\.toString\("hex"\)/);
    assert.match(source, /createHash\("sha256"\)/);
    assert.match(source, /context\.role\.roleName === "Staff"/);
    assert.doesNotMatch(source, /console\.(?:log|warn|error).*rawToken/);
});

test("migration omits generated full_name and synchronizes Auth email", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const insert = sql.match(/insert into public\.profiles[\s\S]*?on conflict/i)?.[0] ?? "";
    assert.doesNotMatch(insert, /full_name/);
    assert.match(sql, /after update of email on auth\.users/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /where status = 'PendingApproval'/i);
});
