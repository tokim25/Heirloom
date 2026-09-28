// Pure helpers for reading recipe pages. Kept free of server-only imports so they can be unit tested.

export const BLOCK_PAGE_MARKERS = [
  'Attention Required! | Cloudflare',
  'Sorry, you have been blocked',
  'cf-browser-verification',
  '<title>Just a moment...</title>',
];


const decodeEntities = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

export const httpUrlOrEmpty = (value: unknown, base: string): string => {
  const candidate = Array.isArray(value) ? value[0] : value;
  const raw = typeof candidate === 'string' ? candidate : typeof candidate?.url === 'string' ? candidate.url : '';
  if (!raw) return '';
  try {
    const resolved = new URL(raw, base);
    return resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.toString() : '';
  } catch {
    return '';
  }
};

export interface PageData {
  ldRecipe: any | null;
  text: string;
  image: string;
  description: string;
}

export function extractPageData(html: string, pageUrl: string): PageData {
  let ldRecipe: any = null;
  const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const isRecipe = (node: any) => node && (node['@type'] === 'Recipe' || (Array.isArray(node['@type']) && node['@type'].includes('Recipe')));
  for (const block of ldBlocks) {
    try {
      const parsed = JSON.parse(block.replace(/<script[^>]*>|<\/script>/gi, '').trim());
      const candidates = [parsed, ...(Array.isArray(parsed) ? parsed : []), ...(Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [])];
      const found = candidates.find(isRecipe);
      if (found) {
        ldRecipe = found;
        break;
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  const meta = (property: string) => {
    const match =
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, 'i'));
    return match ? decodeEntities(match[1]) : '';
  };

  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 15000);

  return {
    ldRecipe,
    text,
    image: httpUrlOrEmpty(ldRecipe?.image, pageUrl) || httpUrlOrEmpty(meta('og:image'), pageUrl),
    description: meta('og:description') || meta('description'),
  };
}

export const YOUTUBE_ID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i;

/** Creators often put the full recipe in the video description; pull it from the watch page. */
export function extractYouTubeDescription(html: string): string {
  const match = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (!match) return '';
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return '';
  }
}

/** True for loopback, private, link-local and other non-public addresses (IPv4 and IPv6). */
export const isPrivateAddress = (address: string): boolean => {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') ||
    lower.startsWith('fe80') || lower.startsWith('::ffff:');
};

/** True only when Gemini's URL fetcher reports it really retrieved the page (not a guess). */
export const urlRetrievedSuccessfully = (response: any): boolean => {
  const metadata = response?.candidates?.[0]?.urlContextMetadata?.urlMetadata;
  return (
    Array.isArray(metadata) &&
    metadata.some((entry: any) => entry?.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS')
  );
};

export interface SourceFromUrl {
  source: { type: 'link' | 'youtube'; url: string; sourceName: string; youtubeId?: string };
  heroImage: string;
}

/**
 * Builds the recipe source for text the user pasted from a page Heirloom could not read,
 * so the saved recipe still links back to the original. The URL is never fetched.
 */
export function sourceFromPastedUrl(raw: unknown): SourceFromUrl | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const youtubeId = url.toString().match(YOUTUBE_ID)?.[1];
  if (youtubeId) {
    return {
      source: { type: 'youtube', url: url.toString(), youtubeId, sourceName: 'YouTube' },
      heroImage: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }
  return {
    source: { type: 'link', url: url.toString(), sourceName: url.hostname.replace(/^www\./, '') },
    heroImage: '',
  };
}
