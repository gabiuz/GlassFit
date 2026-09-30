import assert from "node:assert/strict";
import test from "node:test";
import { normalizePersonName } from "../../src/lib/identity/personName";

test("accepts mononyms and normalizes whitespace", () => {
    assert.deepEqual(normalizePersonName({ firstName: "  Prince  ", lastName: "" }), {
        ok: true,
        value: { firstName: "Prince", lastName: "", fullName: "Prince" },
    });
});

test("accepts international letters, combining marks, apostrophes, and dashes", () => {
    const result = normalizePersonName({ firstName: " Jose\u0301 ", lastName: "O\u2019Neill-Santos" });
    assert.deepEqual(result, {
        ok: true,
        value: { firstName: "Jos\u00e9", lastName: "O\u2019Neill-Santos", fullName: "Jos\u00e9 O\u2019Neill-Santos" },
    });
});

test("counts Unicode code points and rejects invalid punctuation", () => {
    const tooLong = normalizePersonName({ firstName: "\u00c9".repeat(51) });
    assert.equal(tooLong.ok, false);
    const invalid = normalizePersonName({ firstName: "Jane<script>" });
    assert.deepEqual(invalid, { ok: false, field: "firstName", error: "First name contains unsupported characters." });
});

test("requires a letter in every supplied field", () => {
    assert.deepEqual(normalizePersonName({ firstName: "..." }), {
        ok: false,
        field: "firstName",
        error: "First name must contain at least one letter.",
    });
});

test("rejects control and invisible format characters", () => {
    assert.equal(normalizePersonName({ firstName: "Jane\nDoe" }).ok, false);
    assert.equal(normalizePersonName({ firstName: "Jane", lastName: "D\u200Boe" }).ok, false);
});
