import { expect, test, type Page } from "@playwright/test";
import type { Prayer } from "../../src/lib/prayers/types";

// These UI contract tests deliberately intercept every CMS API request. They do
// not verify live persistence; real Supabase verification is recorded separately.
// Run the isolated test server with CMS_ADMIN_MODE=local and no VERCEL env.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

function fixture(index: number): Prayer {
  return {
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    source_key: null, title: `UI 검증용 기도 ${String(index).padStart(2, "0")}`,
    content: "하나님, 잠깐 멈추고 지금 필요한 선택을 돌아보게 해 주세요.\n이 내용은 자동 UI 테스트에서만 사용하는 가상 콘텐츠입니다.",
    category: index % 2 ? "마음" : "디지털", category_full: index % 2 ? "마음 관리 & 멘탈 케어" : "디지털 라이프 & 소비 습관",
    keyword: "멈춤", scripture_ref: "테스트 구절", scripture_text: "UI 동작 확인용 문구입니다.", language: "ko",
    status: index === 20 ? "draft" : "published", image_path: null, cover_url: null, source_order: null,
    created_at: "2026-11-17T00:00:00.000Z", updated_at: "2026-11-17T00:00:00.000Z",
  };
}

type MockState = {
  items: Prayer[];
  posts: number;
  deletes: number;
  patches: number;
  failCreateOnce: boolean;
  conflictUpdate: boolean;
  readFailure: boolean;
  submittedIds: string[];
};

async function mockCms(page: Page, baseURL: string | undefined): Promise<MockState> {
  const state: MockState = { items: Array.from({ length: 20 }, (_, index) => fixture(index + 1)), posts: 0, deletes: 0, patches: 0, failCreateOnce: false, conflictUpdate: false, readFailure: false, submittedIds: [] };
  const origin = new URL(baseURL!).origin;
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!/^\/api\/(?:admin\/)?prayers(?:\/|$)/.test(url.pathname)) {
      if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, json: { error: { message: "테스트에서 허용되지 않은 API 요청입니다." } } });
      return route.continue();
    }
    const admin = url.pathname.startsWith("/api/admin/");
    const id = url.pathname.match(/\/prayers\/([^/]+)$/)?.[1];
    if (request.method() === "GET") {
      if (state.readFailure) return route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "잠시 연결을 확인하지 못했습니다. 다시 시도해 주세요." } } });
      if (id) {
        const item = state.items.find(item => item.id === id && (admin || item.status === "published"));
        return item ? route.fulfill({ json: { data: item } }) : route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "기도문을 찾을 수 없습니다." } } });
      }
      const allowed = state.items.filter(item => admin || item.status === "published");
      const filtered = allowed.filter(item => (!url.searchParams.get("category") || item.category === url.searchParams.get("category")) && (!url.searchParams.get("status") || item.status === url.searchParams.get("status")));
      const pageNumber = Number(url.searchParams.get("page") || 1); const pageSize = Number(url.searchParams.get("pageSize") || 9);
      return route.fulfill({ json: { data: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: filtered.length, page: pageNumber, pageSize, categories: [...new Set(allowed.map(item => item.category).filter(Boolean))] } });
    }
    if (!admin) return route.fulfill({ status: 405, json: { error: { message: "읽기 전용입니다." } } });
    if (request.method() === "DELETE") {
      state.deletes += 1;
      state.items = state.items.filter(item => item.id !== id);
      return route.fulfill({ json: { data: { id } } });
    }
    const raw = request.postDataBuffer()?.toString() || "";
    const json = raw.match(/name="payload"\r\n\r\n([\s\S]*?)\r\n--/)?.[1];
    if (!json) return route.fulfill({ status: 400, json: { error: { message: "payload가 없습니다." } } });
    const payload = JSON.parse(json);
    if (request.method() === "POST") {
      state.posts += 1; state.submittedIds.push(payload.clientRequestId);
      if (state.failCreateOnce) { state.failCreateOnce = false; return route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "저장하지 못했습니다. 입력한 내용을 유지하고 다시 시도해 주세요." } } }); }
      const created: Prayer = { ...fixture(99), ...payload, id: payload.clientRequestId, cover_url: raw.includes('name="cover"') ? `data:image/png;base64,${png.toString("base64")}` : null };
      state.items.unshift(created);
      await new Promise(resolve => setTimeout(resolve, 200));
      return route.fulfill({ status: 201, json: { data: created } });
    }
    state.patches += 1;
    if (state.conflictUpdate) return route.fulfill({ status: 409, json: { error: { code: "CONFLICT", message: "다른 곳에서 수정된 기도문입니다. 최신 내용을 불러와 주세요." } } });
    const item = state.items.find(item => item.id === id)!;
    Object.assign(item, payload, { updated_at: "2026-11-18T00:00:00.000Z" });
    return route.fulfill({ json: { data: item } });
  });
  return state;
}

for (const width of [1440, 393]) {
  test(`CMS UI contract: public category, pagination and no overflow at ${width}px`, async ({ page, baseURL }) => {
    await mockCms(page, baseURL);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/prayers");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("지금, 어떤 기도가 필요한가요?");
    await expect(page.locator(".m6-prayer-card")).toHaveCount(9);
    await expect(page.getByText("총 19개의 기도문")).toBeVisible();
    await page.getByRole("button", { name: "다음 페이지", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(".m6-prayer-card").first()).toContainText("UI 검증용 기도 10");
    await page.reload();
    await expect(page.getByRole("button", { name: "2페이지", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByLabel("카테고리", { exact: true }).selectOption("디지털");
    await expect(page.getByText("총 9개의 기도문")).toBeVisible();
    await expect(page.locator(".m6-prayer-card")).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText("UI 검증용 기도 20", { exact: true })).toHaveCount(0);
  });
}

test("CMS UI contract: prayer timer pauses, resumes and finishes without write requests", async ({ page, baseURL }) => {
  const state = await mockCms(page, baseURL);
  await page.goto(`/prayers/${fixture(1).id}`);
  await expect(page.getByRole("region", { name: "기도문 본문" })).toContainText("가상 콘텐츠");
  await page.getByRole("link", { name: "기도 시작하기" }).click();
  await expect(page.getByRole("timer")).toHaveAttribute("aria-label", "기도 시간 0분 0초");
  await page.getByRole("button", { name: "기도 시작하기", exact: true }).click();
  await expect.poll(() => page.getByRole("timer").getAttribute("aria-label")).toMatch(/기도 시간 0분 [1-9]초/);
  await page.getByRole("button", { name: "잠시 멈추기" }).click();
  const paused = await page.getByRole("timer").getAttribute("aria-label");
  await page.waitForTimeout(1200);
  await expect(page.getByRole("timer")).toHaveAttribute("aria-label", paused!);
  await page.getByRole("button", { name: "계속 기도하기" }).click();
  await expect(page.getByRole("status")).toHaveText("기도하는 시간입니다.");
  await page.getByRole("button", { name: "기도 마치기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "잠깐의 기도를 마쳤어요." })).toBeVisible();
  expect(state.posts + state.patches + state.deletes).toBe(0);
});

test("CMS UI contract: required values, image validation and safe retry retain the form", async ({ page, baseURL }) => {
  const state = await mockCms(page, baseURL); state.failCreateOnce = true;
  await page.goto("/admin/prayers/new");
  await page.getByRole("button", { name: "기도문 등록하기", exact: true }).click();
  await expect(page.getByLabel("제목", { exact: false })).toHaveAttribute("aria-invalid", "true");
  expect(state.posts).toBe(0);
  await page.getByLabel("제목", { exact: false }).fill("검증 후 등록하는 기도문");
  await page.locator("#prayer-category").selectOption("마음");
  await page.getByLabel("기도문 본문", { exact: false }).fill("UI 테스트용 등록 본문입니다.");
  await page.locator("#prayer-cover").setInputFiles({ name: "not-allowed.gif", mimeType: "image/gif", buffer: png });
  await expect(page.getByText("JPG, PNG, WebP 파일을 선택해 주세요.")).toBeVisible();
  await page.getByRole("button", { name: "기도문 등록하기", exact: true }).click();
  expect(state.posts).toBe(0);
  await page.locator("#prayer-cover").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "기도문 등록하기", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("저장하지 못했어요.");
  await expect(page.getByLabel("제목", { exact: false })).toHaveValue("검증 후 등록하는 기도문");
  await page.getByRole("button", { name: "기도문 등록하기", exact: true }).dblclick();
  await expect(page.getByRole("heading", { name: "검증 후 등록하는 기도문", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("새 기도문을 등록했습니다.");
  expect(state.posts).toBe(2);
  expect(state.submittedIds[0]).toBe(state.submittedIds[1]);
  expect(state.items.filter(item => item.title === "검증 후 등록하는 기도문")).toHaveLength(1);
});

test("CMS UI contract: stale edit keeps entered content and prevents overwriting", async ({ page, baseURL }) => {
  const state = await mockCms(page, baseURL); state.conflictUpdate = true;
  await page.goto(`/admin/prayers/${fixture(1).id}/edit`);
  await page.getByLabel("제목", { exact: false }).fill("충돌 시 유지할 제목");
  await page.getByRole("button", { name: "변경 사항 저장", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("다른 변경 사항이 있습니다.");
  await expect(page.getByLabel("제목", { exact: false })).toHaveValue("충돌 시 유지할 제목");
  await expect(page.getByRole("button", { name: "변경 사항 저장", exact: true })).toBeDisabled();
  expect(state.patches).toBe(1);
  expect(state.items[0].title).toBe(fixture(1).title);
});

test("CMS UI contract: delete requires confirmation and stays removed after refresh", async ({ page, baseURL }) => {
  const state = await mockCms(page, baseURL);
  await page.goto("/admin/prayers");
  await page.getByRole("button", { name: `삭제: ${fixture(1).title}`, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(state.deletes).toBe(0);
  await page.getByRole("button", { name: `삭제: ${fixture(1).title}`, exact: true }).click();
  await page.getByRole("button", { name: "기도문 삭제", exact: true }).click();
  await expect(page.getByRole("link", { name: fixture(1).title, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: fixture(1).title, exact: true })).toHaveCount(0);
  expect(state.deletes).toBe(1);
});

test("CMS UI contract: real empty, unavailable and missing-resource states stay explicit", async ({ page, baseURL }) => {
  const state = await mockCms(page, baseURL); state.items = [];
  await page.goto("/prayers");
  await expect(page.getByRole("heading", { name: "기도 가이드를 준비하고 있어요." })).toBeVisible();
  state.readFailure = true; await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("지금 기도문을 불러오지 못했어요.");
  await expect(page.locator(".m6-prayer-card")).toHaveCount(0);
  state.readFailure = false;
  await page.goto(`/prayers/${fixture(1).id}`);
  await expect(page.getByRole("heading", { name: "기도문을 찾을 수 없어요." })).toBeVisible();
});
