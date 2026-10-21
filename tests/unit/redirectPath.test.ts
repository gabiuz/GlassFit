/**
 * Unit Tests for Safe Post-Auth Redirection Resolution (IMP-MS41)
 *
 * Traceability: BRD-M4, PRD-F10, PRD-F12, PRD-F13, SDD-C5, SDD-C7, QAD-TC12, QAD-TC13, QAD-TC56
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import assert from "node:assert/strict";
import test from "node:test";
import { resolveSafeRedirectPath } from "../../src/lib/auth/redirectPath";

test("returns internal relative paths intact", () => {
  const params1 = new URLSearchParams("next=/send-booking");
  assert.equal(resolveSafeRedirectPath(params1), "/send-booking");

  const params2 = new URLSearchParams("next=/quotation");
  assert.equal(resolveSafeRedirectPath(params2), "/quotation");

  const params3 = new URLSearchParams("next=/visualize/p1/workspace");
  assert.equal(resolveSafeRedirectPath(params3), "/visualize/p1/workspace");
});

test("preserves query parameters on valid internal paths", () => {
  const params = new URLSearchParams();
  params.set("next", "/send-booking?ref=123&type=window");
  assert.equal(resolveSafeRedirectPath(params), "/send-booking?ref=123&type=window");

  const urlWithEncoded = new URLSearchParams(`next=${encodeURIComponent("/send-booking?ref=123&type=window")}`);
  assert.equal(resolveSafeRedirectPath(urlWithEncoded), "/send-booking?ref=123&type=window");
});

test("falls back to default / when searchParams is null, undefined, or empty", () => {
  assert.equal(resolveSafeRedirectPath(null), "/");
  assert.equal(resolveSafeRedirectPath(undefined), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams()), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("other=123")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=   ")), "/");
});

test("supports custom fallback values", () => {
  assert.equal(resolveSafeRedirectPath(null, "/custom-fallback"), "/custom-fallback");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams(), "/dashboard"), "/dashboard");
  assert.equal(
    resolveSafeRedirectPath(new URLSearchParams("next=https://malicious.com"), "/fallback"),
    "/fallback"
  );
});

test("rejects external absolute URLs", () => {
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=https://phishing.com")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=http://evil.com")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=ftp://evil.com/path")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=javascript:alert(1)")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=data:text/html,evil")), "/");
});

test("rejects protocol-relative URLs", () => {
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=//malicious.com")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=//send-booking")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=///evil.com")), "/");
});

test("rejects backslash sequences and control characters", () => {
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=/\\evil.com")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=\\evil.com")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=/test\\evil.com")), "/");
  assert.equal(resolveSafeRedirectPath(new URLSearchParams("next=/\0evil.com")), "/");
});

test("supports redirect key when next is absent", () => {
  const params = new URLSearchParams("redirect=/send-booking");
  assert.equal(resolveSafeRedirectPath(params), "/send-booking");
});

test("gives precedence to next over redirect when both are present", () => {
  const params = new URLSearchParams("next=/send-booking&redirect=/quotation");
  assert.equal(resolveSafeRedirectPath(params), "/send-booking");
});
