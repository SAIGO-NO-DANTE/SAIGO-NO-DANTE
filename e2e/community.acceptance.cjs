// Opt-in integration check against a running local build and its configured Supabase.
// Creates isolated example.invalid accounts; always removes their fixtures.
// Run: node --env-file=.env.local e2e/community.acceptance.cjs
const { createClient } = require("@supabase/supabase-js");
const { encode } = require("next-auth/jwt");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = "http://localhost:3001";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);
const out = process.env.COMMUNITY_QA_OUTPUT || "/tmp/limbus-community-qa";
fs.mkdirSync(out, { recursive: true });
const userIds = [],
  deckIds = [],
  inquiryIds = [];
let browser;
async function checked(q) {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function actor(role) {
  const email = `community-qa-${role}-${Date.now()}@example.invalid`;
  const data = await checked(
    db.auth.admin.createUser({ email, email_confirm: true }),
  );
  const id = data.user.id;
  userIds.push(id);
  await checked(
    db
      .schema("limbus")
      .from("profiles")
      .insert({
        id,
        username: `QA_${role}`,
        role: role === "admin" ? "admin" : "user",
        bio: "좋은 편성을 나누고 도감을 함께 만들어갑니다.",
      }),
  );
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    token: {
      sub: id,
      email,
      name: "Local verification",
      isAdmin: role === "admin",
      isSuspended: false,
    },
    maxAge: 3600,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return { id, context };
}
async function req(actor, url, method = "GET", body, expected = 200) {
  const options = {
    method,
    headers: { Origin: base },
    ...(body ? { data: body } : {}),
  };
  let r = await actor.context.request.fetch(base + url, options);
  if (r.status() === 429) {
    const seconds = Number(r.headers()["retry-after"]) || 60;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(seconds + 1, 61) * 1000),
    );
    r = await actor.context.request.fetch(base + url, options);
  }
  assert.equal(
    r.status(),
    expected,
    `${method} ${url} returned ${r.status()}: ${expected === 200 || expected === 201 ? await r.text() : ""}`,
  );
  return r;
}
async function stats(actor, points) {
  const d = await (await req(actor, "/api/community/me")).json();
  assert.equal(d.stats.points, points);
  return d;
}
async function deck(actor, identity, title) {
  const r = await req(
    actor,
    "/api/decks",
    "POST",
    {
      title,
      description: "Local integration fixture",
      lang: "ko",
      identitySlots: [
        { identity_id: identity, slot_order: 1, gacksung: false },
      ],
    },
    201,
  );
  const d = await r.json();
  deckIds.push(d.id);
  return d.id;
}
async function cleanup() {
  if (inquiryIds.length)
    await checked(
      db.schema("limbus").from("inquiries").delete().in("id", inquiryIds),
    );
  if (deckIds.length)
    await checked(db.schema("limbus").from("decks").delete().in("id", deckIds));
  if (userIds.length) {
    await checked(
      db.schema("limbus").from("audit_logs").delete().in("actor_id", userIds),
    );
    await checked(
      db.schema("limbus").from("profiles").delete().in("id", userIds),
    );
    for (const id of userIds) await checked(db.auth.admin.deleteUser(id));
  }
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const author = await actor("author"),
    user = await actor("reader"),
    admin = await actor("admin");
  const anon = { context: await browser.newContext() };
  const identity = (
    await checked(db.schema("limbus").from("identities").select("id").limit(1))
  )[0].id;
  await req(anon, "/api/community/me", "GET", null, 401);
  const targets = [];
  for (let i = 0; i < 6; i++)
    targets.push(await deck(author, identity, `검증용 편성 ${i + 1}`));
  await stats(author, 60);
  const ownDeck = await deck(user, identity, "함께 만드는 편성");
  await req(user, `/api/decks/${ownDeck}/vote`, "POST");
  await stats(user, 20);
  for (const id of targets) await req(user, `/api/decks/${id}/vote`, "POST");
  await stats(user, 30);
  await req(user, `/api/decks/${targets[0]}/vote`, "POST");
  await stats(user, 28);
  await req(user, `/api/decks/${targets[0]}/vote`, "POST");
  await stats(user, 30);
  await req(author, `/api/decks/${targets[0]}`, "DELETE");
  await stats(author, 40);
  await stats(user, 28);
  const report = await (
    await req(
      user,
      "/api/inquiries",
      "POST",
      {
        title: "검증용 DB 수정 제안",
        content: "기여 승인 검증",
        category: "data",
        contribution_accepted: true,
      },
      201,
    )
  ).json();
  inquiryIds.push(report.id);
  await stats(user, 28);
  await req(
    user,
    `/api/admin/inquiries/${report.id}`,
    "PATCH",
    { reply: "Fixed", status: "answered", contribution_accepted: true },
    403,
  );
  await req(
    admin,
    `/api/admin/inquiries/${report.id}`,
    "PATCH",
    { reply: "", status: "closed", contribution_accepted: true },
    400,
  );
  const ap = await admin.context.newPage();
  await ap.goto(base + "/ko/admin");
  await ap.getByRole("button", { name: /검증용 DB 수정 제안/ }).click();
  await ap
    .getByLabel("관리자 답변", { exact: true })
    .fill("원본 확인 후 DB에 반영했습니다.");
  await ap.getByLabel("처리 상태").selectOption("answered");
  await ap
    .getByLabel("DB 수정 기여 승인 (+50 활동 점수)", { exact: true })
    .check();
  const savedReply = ap.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/inquiries/") &&
      r.request().method() === "PATCH",
  );
  await ap.getByRole("button", { name: "답변 저장", exact: true }).click();
  const replyResponse = await savedReply;
  assert.equal(replyResponse.status(), 200, await replyResponse.text());
  await stats(user, 78);
  await req(admin, `/api/admin/inquiries/${report.id}`, "PATCH", {
    reply: "Fixed",
    status: "answered",
    contribution_accepted: true,
  });
  await stats(user, 78);
  await req(admin, `/api/admin/inquiries/${report.id}`, "PATCH", {
    reply: "Reopened",
    status: "open",
    contribution_accepted: false,
  });
  await stats(user, 28);
  await req(admin, `/api/admin/inquiries/${report.id}`, "PATCH", {
    reply: "Fixed",
    status: "answered",
    contribution_accepted: true,
  });
  await stats(user, 78);
  for (const input of [
    { points: 999 },
    { public_profile: true, user_id: author.id },
  ])
    await req(user, "/api/community/me", "PATCH", input, 400);
  let pub = await (
    await req(anon, `/api/community/profiles/${user.id}`)
  ).json();
  assert.deepEqual(
    Object.keys(pub.profile).sort(),
    [
      "id",
      "username",
      "bio",
      "avatar_url",
      "created_at",
      "public_profile",
    ].sort(),
  );
  assert.equal(pub.stats.points, 78);
  await req(user, "/api/community/me", "PATCH", { public_profile: false });
  await req(anon, `/api/community/profiles/${user.id}`, "GET", null, 404);
  await stats(user, 78);
  await req(user, "/api/community/me", "PATCH", { public_profile: true });
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert(publicKey, "Missing public Supabase key");
  const publicDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey,
  );
  assert(
    (await publicDb.schema("limbus").from("profiles").select("*")).error,
    "Private profile columns must not be queryable",
  );
  assert(
    (await publicDb.schema("limbus").from("community_activity").select("*"))
      .error,
    "Ledger must stay server-only",
  );
  assert(
    (
      await publicDb.schema("limbus").rpc("community_record_deck", {
        p_deck_id: ownDeck,
        p_user_id: user.id,
      })
    ).error,
  );
  // Allow the shared write-rate window from the API stress checks to expire.
  console.log(
    "API activity and privacy checks passed; waiting for the write-rate window before UI checks.",
  );
  await new Promise((resolve) => setTimeout(resolve, 61000));
  const p = await user.context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/ko/mypage?tab=profile");
  await p.getByLabel("닉네임", { exact: true }).fill("기록하는관리자");
  await p
    .getByLabel(/^소개/)
    .fill("덱을 나누고, 더 정확한 도감을 함께 만들어갑니다.");
  const profileSave = p.waitForResponse(
    (r) => r.url().endsWith("/api/profile") && r.request().method() === "PATCH",
  );
  await p.getByRole("button", { name: "변경 저장", exact: true }).click();
  const ps = await profileSave;
  assert.equal(ps.status(), 200, await ps.text());
  assert.equal(
    (await (await req(user, "/api/community/me")).json()).profile.username,
    "기록하는관리자",
  );
  await p
    .getByRole("heading", { name: "기록하는관리자", exact: true })
    .waitFor();
  // The visibility control is a switch (aria-checked), not a checkbox.
  const visibility = p.getByRole("switch", { name: "프로필 공개", exact: true });
  assert.equal(await visibility.getAttribute("aria-checked"), "true");
  await visibility.click();
  await p.getByText("비공개 프로필", { exact: true }).waitFor();
  assert.equal(await visibility.getAttribute("aria-checked"), "false");
  await req(anon, `/api/community/profiles/${user.id}`, "GET", null, 404);
  await visibility.click();
  await p.getByRole("link", { name: "공개 프로필 보기" }).waitFor();
  assert.equal(await visibility.getAttribute("aria-checked"), "true");
  for (const width of [1440, 390]) {
    await p.setViewportSize({ width, height: 1000 });
    for (const lang of ["ko", "en", "ja"])
      for (const route of [
        `/${lang}/mypage?tab=profile`,
        `/${lang}/users/${user.id}`,
      ]) {
        console.log("Checking", width, route);
        await p.goto(base + route);
        await p
          .locator('[data-testid="activity-points"]:visible')
          .filter({ hasText: "78" })
          .waitFor();
        const cdp = await p.context().newCDPSession(p);
        await cdp.send("Page.reload", { ignoreCache: true });
        await cdp.detach();
        await p
          .locator('[data-testid="activity-points"]:visible')
          .filter({ hasText: "78" })
          .waitFor();
        await p.goto(base + `/${lang}`);
        console.log("Checking", width, route);
        await p.goto(base + route);
        await p
          .locator('[data-testid="activity-points"]:visible')
          .filter({ hasText: "78" })
          .waitFor();
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "Horizontal overflow " + route,
        );
        await p.waitForFunction(() => { const el = document.querySelector('[data-testid="community-profile"]'); return el && getComputedStyle(el).opacity === "1"; });
        await p.screenshot({
          path: path.join(
            out,
            `${width}-${lang}-${route.includes("mypage") ? "my" : "public"}.png`,
          ),
          fullPage: true,
        });
      }
  }
  for (const width of [1440, 1024, 768, 390]) {
    await p.setViewportSize({ width, height: 900 });
    await p.goto(base + "/ko");
    if (width >= 1024) {
      // Support sits in the avatar menu.
      await p.getByRole("button", { name: "사용자 메뉴 열기", exact: true }).click();
      await p.getByRole("link", { name: "문의", exact: true }).waitFor();
    } else {
      await p.getByRole("button", { name: "메뉴 열기", exact: true }).click();
      await p.getByRole("link", { name: "문의", exact: true }).waitFor();
    }
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Navigation overflow",
    );
    await p.screenshot({ path: path.join(out, `navigation-${width}.png`) });
  }
  await p.setViewportSize({ width: 1440, height: 1000 });
  console.log("Checking author link", user.id);
  await p.goto(base + "/ko/decks");
  console.log(
    "Author href",
    await p
      .getByRole("link", { name: "기록하는관리자", exact: true })
      .first()
      .getAttribute("href"),
  );
  await p
    .getByRole("link", { name: "기록하는관리자", exact: true })
    .first()
    .click();
  await p
    .locator('[data-testid="activity-points"]:visible')
    .filter({ hasText: "78" })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: activity caps, self-like exclusion, unlike/re-like, deletion, reviewed contributions, profile edits/privacy, API authorization, author links, three locales, Chrome desktop/mobile hard reload and revisit, standalone support navigation.",
  );
})()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log("QA fixtures cleaned.");
    } catch (e) {
      console.error("Fixture cleanup failed:", e.message);
      process.exitCode = 1;
    }
    await browser?.close();
  });
