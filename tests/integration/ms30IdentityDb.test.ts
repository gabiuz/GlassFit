import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const hasIntegrationEnvironment = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.MS30_TEST_USER_ID,
);

test("MS30 database integration environment", { skip: !hasIntegrationEnvironment && "Isolated Supabase MS30 credentials are unavailable." }, async () => {
    const sql = await readFile(new URL("../../supabase/migrations/012_identity_name_and_admin_email_workflow.sql", import.meta.url), "utf8");
    assert.match(sql, /admin_email_change_events/);
    assert.match(sql, /sync_profile_email_from_auth/);
});
