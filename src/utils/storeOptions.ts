export interface StoreOption {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  delivery: string;
  minOrder: string;
  color: string;
  isCustom?: boolean;
}

export const STORES: StoreOption[] = [
  {
    id: 'whole-foods',
    name: 'Whole Foods Market',
    slug: 'whole-foods',
    tagline: 'Organic & Artisan Quality',
    delivery: '1-2 hrs',
    minOrder: '$35',
    color: '#006241',
  },
  {
    id: 'trader-joes',
    name: "Trader Joe's",
    slug: 'trader-joes',
    tagline: 'Neighborhood Favorites & Value',
    delivery: '2 hrs',
    minOrder: '$35',
    color: '#BA1B1D',
  },
  {
    id: 'safeway',
    name: 'Safeway',
    slug: 'safeway',
    tagline: 'Full Grocery Pantry Staples',
    delivery: '1 hr',
    minOrder: '$30',
    color: '#E31837',
  },
  {
    id: 'kroger',
    name: 'Kroger',
    slug: 'kroger',
    tagline: 'Fresh Savings & Bulk Staples',
    delivery: '1-2 hrs',
    minOrder: '$35',
    color: '#004F9F',
  },
  {
    id: 'wegmans',
    name: 'Wegmans',
    slug: 'wegmans',
    tagline: 'Chef-grade Produce & Cheeses',
    delivery: '2 hrs',
    minOrder: '$35',
    color: '#880000',
  },
  {
    id: 'sprouts',
    name: 'Sprouts Farmers Market',
    slug: 'sprouts',
    tagline: 'Farm-Fresh & Bulk Spices',
    delivery: '1 hr',
    minOrder: '$35',
    color: '#2B5E27',
  },
  {
    id: 'costco',
    name: 'Costco',
    slug: 'costco',
    tagline: 'Bulk staples and household favorites',
    delivery: '2 hrs',
    minOrder: '$35',
    color: '#005DAA',
  },
  {
    id: 'h-mart',
    name: 'H Mart',
    slug: 'h-mart',
    tagline: 'Korean pantry, produce, and prepared foods',
    delivery: '2 hrs',
    minOrder: '$35',
    color: '#D71920',
  },
];

export const STORE_NAMES = STORES.map((store) => store.name);

export function resolveStore(storeNameOrId?: string): StoreOption {
  if (!storeNameOrId) return STORES[0];

  const clean = storeNameOrId.trim();
  const cleanLower = clean.toLowerCase();
  const found = STORES.find(
    (store) =>
      store.name.toLowerCase() === cleanLower ||
      store.id.toLowerCase() === cleanLower ||
      store.slug.toLowerCase() === cleanLower
  );

  if (found) return found;

  return {
    id: `custom-${cleanLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store'}`,
    name: clean,
    slug: '',
    tagline: 'Custom store selection',
    delivery: 'Varies',
    minOrder: 'Varies',
    color: '#44403C',
    isCustom: true,
  };
}

/** Instacart's own search page for one item in one store (opens the app on phones that have it). */
export function instacartSearchUrl(store: StoreOption, query: string): string {
  const q = encodeURIComponent(query.trim());
  return store.slug
    ? `https://www.instacart.com/store/${store.slug}/s?k=${q}`
    : `https://www.instacart.com/store/s?k=${q}`;
}

export function instacartStoreUrl(store: StoreOption): string {
  return store.slug
    ? `https://www.instacart.com/store/${store.slug}/storefront`
    : `https://www.instacart.com/store/s?k=${encodeURIComponent(store.name)}`;
}
