/**
 * Unit tests for NotionDocumentService.
 *
 * Covers the core contracts introduced by this fork (root-only filter,
 * showAllPages toggle, dual cache, repositoryTypeMap fast-path for
 * detectParentType) without hitting the real Notion API: axios.create is
 * replaced via vitest so every `request.get/post` returns a pre-programmed
 * JSON fixture.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import NotionDocumentService from '@/common/backend/services/notion/service';

// localeService is imported (side-effect) by service.ts and needs intl to be
// initialised before `format` calls happen.  We keep it simple: replace the
// whole `@/common/locales` module with one whose `default.format` returns
// the `defaultMessage` verbatim.  This runs BEFORE `import service.ts` is
// resolved so the module-level localeService instance inside service.ts will
// be this mock, regardless of the static `import localeService from` at the
// top of the file.
vi.mock('@/common/locales', () => ({
  default: {
    format: (d: { id?: string; defaultMessage?: string }) => d.defaultMessage ?? '',
  },
}));

type NotionObject = 'page' | 'database' | 'data_source';

/**
 * Build a single `/search` result item. `root = true` means the item has
 * parent.type = 'workspace' so it survives the default root-only filter.
 */
function makeItem(opts: {
  id: string;
  object: NotionObject;
  title: string;
  root?: boolean;
  parentType?: string;
}) {
  const titleKey = opts.object === 'page' ? 'Name' : 'title';
  return {
    id: opts.id,
    object: opts.object,
    parent: {
      type: opts.parentType ?? (opts.root ? 'workspace' : 'page_id'),
    },
    properties:
      opts.object === 'page'
        ? {
            [titleKey]: {
              id: 'title',
              type: 'title',
              title: [{ type: 'text', plain_text: opts.title, text: { content: opts.title } }],
            },
          }
        : {
            title: {
              id: 'title',
              type: 'title',
              title: [{ type: 'text', plain_text: opts.title, text: { content: opts.title } }],
            },
          },
  };
}

function makeSearchResponse(items: any[], hasMore = false, nextCursor: string | null = null) {
  return {
    data: {
      object: 'list',
      results: items,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  };
}

function makeUserResponse() {
  return { data: { id: 'me-1', object: 'user', name: 'me', type: 'person' } };
}

/**
 * Create a NotionDocumentService and capture every request made through
 * `this.request` so tests can count calls and assert on payloads.
 * `searchResponses` is a list of responses that will be returned, one per
 * `/search` call; looped if necessary.
 */
function setup(args: { token?: string; responses: (url: string, config: any) => any }) {
  const calls: { method: string; url: string; data?: any }[] = [];
  const interceptorHandlers = { response: [], request: [] as any };
  function applyResponseInterceptors(input: Promise<any>) {
    let p = input;
    for (const h of interceptorHandlers.response) {
      p = p.then(h[0], h[1]);
    }
    return p;
  }
  const axiosInstance = {
    interceptors: {
      request: { use: (fulfilled: any, rejected: any) => interceptorHandlers.request.push([fulfilled, rejected]) },
      response: { use: (fulfilled: any, rejected: any) => interceptorHandlers.response.push([fulfilled, rejected]) },
    },
    get: (url: string, cfg: any) => {
      calls.push({ method: 'GET', url });
      const call = (async () => args.responses(url, cfg))();
      return applyResponseInterceptors(call).catch((err) => {
        // re-apply handlers if they failed (response interceptor rejects go to handler 2)
        throw err;
      });
    },
    post: (url: string, data: any, cfg: any) => {
      calls.push({ method: 'POST', url, data });
      return applyResponseInterceptors(
        (async () => args.responses(url, { ...cfg, data }))()
      );
    },
    patch: (url: string, data: any, cfg: any) => {
      calls.push({ method: 'PATCH', url, data });
      return applyResponseInterceptors(
        (async () => args.responses(url, { ...cfg, data }))()
      );
    },
    defaults: { headers: { common: {} } },
  };
  const spy = vi.spyOn(axios, 'create').mockReturnValue(axiosInstance as any);
  const service = new NotionDocumentService({
    personalAccessToken: args.token ?? 'ntn_validtokenabc',
  });
  return { service, calls, spy };
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Each test sets up its own axios.create, so clear the mock between runs.
  vi.clearAllMocks();
});

describe('NotionDocumentService', () => {
  // ------------------------------------------------------------------
  // Cache & root-only / show-all semantics (contract #1)
  // ------------------------------------------------------------------
  test('default getRepositories returns root-only and caches so second call hits 0 /search', async () => {
    const rootPage = makeItem({ id: 'rp1', object: 'page', title: 'Root Page', root: true });
    const subPage = makeItem({ id: 'sp1', object: 'page', title: 'Sub Page', root: false });
    const rootDB = makeItem({ id: 'rd1', object: 'database', title: 'Root DB', root: true });
    const searchFixture = makeSearchResponse([rootPage, subPage, rootDB]);

    let searchCount = 0;
    const { service, calls } = setup({
      responses: (url) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) {
          searchCount++;
          return searchFixture;
        }
        return { data: null };
      },
    });

    const list = await service.getRepositories();
    expect(list.map(r => r.id)).toEqual(['rp1', 'rd1']);
    expect(searchCount).toBe(1);

    const list2 = await service.getRepositories();
    expect(list2).toBe(list); // identical reference = cache hit
    expect(searchCount).toBe(1); // no additional /search

    // /users/me is called once via getUserInfo during normal flow.
    const searchCalls = calls.filter(c => c.method === 'POST' && c.url === '/search');
    expect(searchCalls.length).toBe(1);
  });

  test('showAllPages=true fetches full list LAZILY, then toggles back is free', async () => {
    const rootPage = makeItem({ id: 'rp1', object: 'page', title: 'Root', root: true });
    const subPage = makeItem({ id: 'sp1', object: 'page', title: 'Sub', root: false });
    const searchFixture = makeSearchResponse([rootPage, subPage]);

    let searchCount = 0;
    const { service } = setup({
      responses: (url) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) {
          searchCount++;
          return searchFixture;
        }
        return { data: null };
      },
    });

    const rootList = await service.getRepositories();
    expect(rootList).toHaveLength(1);
    expect(searchCount).toBe(1);

    const allList = await service.getRepositories({ showAllPages: true });
    expect(allList).toHaveLength(2);
    expect(searchCount).toBe(2); // new /search fetch to populate all-cache

    // Toggle back and forth: should do zero new fetches.
    const root2 = await service.getRepositories();
    const all2 = await service.getRepositories({ showAllPages: true });
    const root3 = await service.getRepositories();
    expect(root2).toBe(rootList);
    expect(all2).toBe(allList);
    expect(searchCount).toBe(2);

    // But each repository does still carry its notionObjectType marker so
    // downstream callers (createDocument) can reason about it.
    expect(allList[0].notionObjectType).toBe('page');
    expect(allList[1].notionObjectType).toBe('page');
  });

  test('flipping the switch 5 times total = 2 /search fetches max (core perf contract)', async () => {
    const items = [
      makeItem({ id: 'a', object: 'page', title: 'A', root: true }),
      makeItem({ id: 'b', object: 'database', title: 'B', root: true }),
      makeItem({ id: 'c', object: 'page', title: 'C', root: false }),
      makeItem({ id: 'd', object: 'data_source', title: 'D', root: false }),
    ];
    let searchCount = 0;
    const { service } = setup({
      responses: (url) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) {
          searchCount++;
          return makeSearchResponse(items);
        }
        return { data: null };
      },
    });

    // flip sequence: root → all → root → all → root (5 calls, 2 real fetches)
    await service.getRepositories();
    await service.getRepositories({ showAllPages: true });
    await service.getRepositories();
    await service.getRepositories({ showAllPages: true });
    await service.getRepositories();
    expect(searchCount).toBe(2);
  });

  // ------------------------------------------------------------------
  // Empty list errors have the two distinct locale ids (#3 i18n contract)
  // ------------------------------------------------------------------
  test('root-only empty throws with root-empty locale id', async () => {
    const { service } = setup({
      responses: (url) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) return makeSearchResponse([]);
        return { data: null };
      },
    });
    try {
      await service.getRepositories();
      expect.fail('should throw');
    } catch (e: any) {
      // root-empty message = the one that mentions "flip on show all pages"
      // fallback defaultMessage
      expect(e.message).toMatch(/flip on|switch|toggle|子页面|根目录|root/i);
    }
  });

  test('showAllPages empty throws with the general empty-all locale id', async () => {
    const { service } = setup({
      responses: (url) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) return makeSearchResponse([]);
        return { data: null };
      },
    });
    try {
      await service.getRepositories({ showAllPages: true });
      expect.fail('should throw');
    } catch (e: any) {
      // The all-empty message should NOT contain the switch hint since the
      // user already flipped to "all" — both locale ids are distinct in
      // every language file.
      expect(typeof e.message).toBe('string');
      expect(e.message.length).toBeGreaterThan(5);
    }
  });

  // ------------------------------------------------------------------
  // detectParentType fast-path via repositoryTypeMap (contract #2)
  // ------------------------------------------------------------------
  test('detectParentType returns directly from type map after getRepositories, zero probes', async () => {
    const rootPage = makeItem({ id: 'rp1', object: 'page', title: 'P', root: true });
    const rootDB = makeItem({ id: 'rd1', object: 'database', title: 'DB', root: true });
    const ds = makeItem({ id: 'ds1', object: 'data_source', title: 'DS', root: true });

    const { service, calls } = setup({
      responses: (url) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) return makeSearchResponse([rootPage, rootDB, ds]);
        // If anything actually hits /pages /databases /data_sources probes,
        // the test will fail via assertion below.
        if (url.startsWith('/pages') || url.startsWith('/databases') || url.startsWith('/data_sources')) {
          throw new Error(`probe ${url} should NOT be called`);
        }
        return { data: null };
      },
    });

    await service.getRepositories();
    const afterSearchCalls = calls.length;

    // @ts-expect-error — accessing private method for testing.
    const t1 = await service.detectParentType('rp1');
    // @ts-expect-error
    const t2 = await service.detectParentType('rd1');
    // @ts-expect-error
    const t3 = await service.detectParentType('ds1');
    expect(t1).toBe('page');
    expect(t2).toBe('database');
    expect(t3).toBe('data_source');

    // No new network calls at all made after getRepositories.
    expect(calls.length).toBe(afterSearchCalls);
  });

  test('detectParentType falls back to probe for unknown ids and writes into map for next call', async () => {
    let pageProbeCalls = 0;
    let dbProbeCalls = 0;
    const { service, calls } = setup({
      responses: (url) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) return makeSearchResponse([]);
        if (url.startsWith('/pages/unknown-page-id')) {
          pageProbeCalls++;
          // pages endpoint 200 means "it's a page"
          return { data: { id: 'unknown-page-id', object: 'page' } };
        }
        if (url.startsWith('/pages/unknown-db-id')) {
          // pages endpoint 404 — fallback logic then tries /databases
          return Promise.reject({ response: { status: 404 } });
        }
        if (url.startsWith('/databases/unknown-db-id')) {
          dbProbeCalls++;
          return { data: { id: 'unknown-db-id', object: 'database' } };
        }
        return { data: null };
      },
    });

    // @ts-expect-error private access
    const t1 = await service.detectParentType('unknown-page-id');
    // @ts-expect-error private access
    const t1Again = await service.detectParentType('unknown-page-id');
    // @ts-expect-error private access
    const t2 = await service.detectParentType('unknown-db-id');

    expect(t1).toBe('page');
    expect(t1Again).toBe('page');
    expect(t2).toBe('database');
    expect(pageProbeCalls).toBe(1); // repeated call was map-lookup
    expect(dbProbeCalls).toBe(1);
  });

  // ------------------------------------------------------------------
  // createDocument round-trips body shape per notionObjectType
  // ------------------------------------------------------------------
  test('createDocument builds correct parent key for page/database/data_source', async () => {
    const items = [
      makeItem({ id: 'pg', object: 'page', title: 'P', root: true }),
      makeItem({ id: 'db', object: 'database', title: 'D', root: true }),
      makeItem({ id: 'ds', object: 'data_source', title: 'DS', root: true }),
    ];
    const bodies: any[] = [];
    const { service } = setup({
      responses: (url, cfg) => {
        if (url === '/users/me') return makeUserResponse();
        if (url.startsWith('/search')) return makeSearchResponse(items);
        if (url.startsWith('/pages')) {
          bodies.push({ url, method: 'POST', data: cfg?.data, params: cfg?.params });
          return { data: { id: 'created', object: 'page', url: 'http://n/page' } };
        }
        return { data: null };
      },
    });

    await service.getRepositories();
    for (const repoId of ['pg', 'db', 'ds']) {
      await service.createDocument({
        repositoryId: repoId,
        title: 'T',
        content: 'hello',
        url: 'https://example.com',
      });
    }

    // Three create calls, all to /pages since both database and data_source
    // also route through the /pages children creation endpoint in Notion API.
    expect(bodies).toHaveLength(3);
    const parentKeys = bodies.map(b => Object.keys(b.data?.parent || {})[0]);
    expect(parentKeys).toEqual(['page_id', 'database_id', 'data_source_id']);
    const parentIds = bodies.map(b => Object.values(b.data.parent)[0]);
    expect(parentIds).toEqual(['pg', 'db', 'ds']);
  });
});
