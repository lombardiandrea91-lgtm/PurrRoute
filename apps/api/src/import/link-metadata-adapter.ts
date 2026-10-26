import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import type { LinkPreviewResponse } from '@purrroute/contracts';

const userAgent = 'PurrRouteLinkPreview/1.0';
const pageLimit = 1_000_000;
const robotsLimit = 128_000;
const timeoutMs = 8_000;
const redirectLimit = 3;

export class LinkImportError extends Error {
  constructor() {
    super('link_preview_blocked');
  }
}

export interface LinkMetadataFetchResult {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

type LinkMetadataFetcher = (url: URL, maxBytes: number) => Promise<LinkMetadataFetchResult>;

async function resolvePublicAddress(hostname: string) {
  let addresses;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new LinkImportError()), timeoutMs);
      }),
    ]);
    if (!addresses.length || addresses.some(({ address }) => {
      try {
        return ipaddr.parse(address).range() !== 'unicast';
      } catch {
        return true;
      }
    })) throw new LinkImportError();
    const selected = addresses[0];
    if (!selected) throw new LinkImportError();
    return selected;
  } catch {
    throw new LinkImportError();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function validateTarget(url: URL): void {
  if (url.protocol !== 'https:' || url.username || url.password
    || (url.port !== '' && url.port !== '443') || !url.hostname) {
    throw new LinkImportError();
  }
  url.hash = '';
}

async function getPinned(url: URL, maxBytes: number): Promise<LinkMetadataFetchResult> {
  const address = await resolvePublicAddress(url.hostname);
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: 'GET',
      headers: {
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
        'accept-encoding': 'identity',
      },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, (response) => {
      const contentLength = Number(response.headers['content-length'] ?? 0);
      if (contentLength > maxBytes || response.headers['content-encoding']?.toString() !== undefined
        && response.headers['content-encoding']?.toString() !== 'identity') {
        response.destroy(new LinkImportError());
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          response.destroy(new LinkImportError());
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
      response.on('error', reject);
    });
    const timer = setTimeout(() => request.destroy(new LinkImportError()), timeoutMs);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
    request.end();
  });
}

async function getPinnedSafely(url: URL, maxBytes: number): Promise<LinkMetadataFetchResult> {
  try {
    return await getPinned(url, maxBytes);
  } catch {
    throw new LinkImportError();
  }
}

function robotsAllow(contents: string, path: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let group: { agents: string[]; rules: { allow: boolean; path: string }[] } | null = null;
  let sawRule = false;
  for (const line of contents.split(/\r?\n/)) {
    const [rawName, ...rawValue] = line.split(':');
    if (!rawName || rawValue.length === 0) continue;
    const name = rawName.trim().toLowerCase();
    const value = (rawValue.join(':').split('#', 1)[0] ?? '').trim();
    if (name === 'user-agent') {
      if (!group || sawRule) {
        group = { agents: [], rules: [] };
        groups.push(group);
        sawRule = false;
      }
      group.agents.push(value.toLowerCase());
    } else if ((name === 'allow' || name === 'disallow') && group && value) {
      group.rules.push({ allow: name === 'allow', path: value });
      sawRule = true;
    }
  }
  const exact = groups.filter((item) => item.agents.includes('purrroutelinkpreview'));
  const selected = exact.length ? exact : groups.filter((item) => item.agents.includes('*'));
  const rules = selected.flatMap((item) => item.rules)
    .filter((rule) => robotsMatches(rule.path, path))
    .sort((left, right) => right.path.length - left.path.length);
  return rules[0]?.allow ?? true;
}

function robotsMatches(pattern: string, path: string): boolean {
  if (pattern.endsWith('$')) return new RegExp(`^${pattern.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('\\*', '.*')}$`).test(path);
  const expression = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('\\*', '.*');
  return new RegExp(`^${expression}`).test(path);
}

function readStructuredMetadata($: ReturnType<typeof load>): { name?: string; description?: string } {
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    try {
      const value: unknown = JSON.parse($(element).text());
      const candidates: unknown[] = Array.isArray(value) ? value : [value];
      while (candidates.length) {
        const candidate = candidates.shift();
        if (!candidate || typeof candidate !== 'object') continue;
        const record = candidate as Record<string, unknown>;
        if (typeof record.name === 'string' || typeof record.description === 'string') {
          const metadata: { name?: string; description?: string } = {};
          if (typeof record.name === 'string') metadata.name = record.name;
          if (typeof record.description === 'string') metadata.description = record.description;
          return metadata;
        }
        for (const nested of Object.values(record)) {
          if (Array.isArray(nested)) candidates.push(...nested);
          else if (nested && typeof nested === 'object') candidates.push(nested);
        }
      }
    } catch {
      continue;
    }
  }
  return {};
}

function cleanText(value: string | undefined, maxLength: number): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

export class LinkMetadataAdapter {
  private readonly fetcher: LinkMetadataFetcher;

  constructor(fetcher: LinkMetadataFetcher = getPinnedSafely) {
    this.fetcher = fetcher;
  }

  async preview(value: string): Promise<LinkPreviewResponse> {
    let target: URL;
    try {
      target = new URL(value);
      validateTarget(target);
    } catch {
      throw new LinkImportError();
    }
    const sourceUrl = target.toString();

    for (let redirects = 0; redirects <= redirectLimit; redirects += 1) {
      validateTarget(target);
      const robotsUrl = new URL('/robots.txt', target);
      const robots = await this.fetcher(robotsUrl, robotsLimit);
      if (robots.statusCode === 200 && !robotsAllow(robots.body, `${target.pathname}${target.search}`)) {
        throw new LinkImportError();
      }
      if (robots.statusCode !== 200 && robots.statusCode !== 404 && robots.statusCode !== 410) {
        throw new LinkImportError();
      }

      const response = await this.fetcher(target, pageLimit);
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        if (typeof location !== 'string' || redirects === redirectLimit) throw new LinkImportError();
        try {
          target = new URL(location, target);
          validateTarget(target);
        } catch {
          throw new LinkImportError();
        }
        continue;
      }
      if (response.statusCode !== 200
        || !/^text\/html(?:\s*;|$)/i.test(String(response.headers['content-type'] ?? ''))) {
        throw new LinkImportError();
      }

      const $ = load(response.body);
      const structured = readStructuredMetadata($);
      const title = cleanText(
        $('meta[property="og:title"]').attr('content')
          ?? $('meta[name="twitter:title"]').attr('content')
          ?? structured.name
          ?? $('title').first().text(),
        240,
      );
      const description = cleanText(
        $('meta[property="og:description"]').attr('content')
          ?? $('meta[name="description"]').attr('content')
          ?? structured.description,
        1000,
      );
      if (!title) throw new LinkImportError();
      return { title, description, sourceUrl };
    }
    throw new LinkImportError();
  }
}