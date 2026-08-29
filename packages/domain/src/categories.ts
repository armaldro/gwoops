/**
 * Category attribute schemas.
 *
 * One definition drives three things that must never drift apart:
 *   1. what Claude is told to extract from a photo,
 *   2. what the review sheet renders as editable fields,
 *   3. what the inventory page offers as filter facets.
 *
 * Adding a field here makes it appear in all three.
 */

export type FieldType = "text" | "number" | "select" | "multiselect" | "date";

export interface AttributeField {
  key: string;
  label: string;
  type: FieldType;
  /** Allowed values for select/multiselect. Also shown to Claude as guidance. */
  options?: readonly string[];
  /** Surfaced as a filter facet on the inventory page. */
  facet?: boolean;
  /** Shown in the compact card summary under the item name. */
  summary?: boolean;
  hint?: string;
}

export interface CategoryDef {
  slug: string;
  label: string;
  icon: string;
  /** Documents are private by default and hidden from shared views. */
  isPrivate?: boolean;
  /**
   * Attributes that must stay evenly spread when rebalancing across homes.
   * Ten shirts each is not a fair split if one house got all the winter coats.
   */
  balanceBy: readonly string[];
  fields: readonly AttributeField[];
}

const SEASONS = [
  "all-season",
  "summer",
  "winter",
  "tropical",
  "transitional",
] as const;
const CONDITIONS = ["new", "excellent", "good", "fair", "worn"] as const;

export const CATEGORIES: readonly CategoryDef[] = [
  {
    slug: "clothing",
    label: "Clothing",
    icon: "👕",
    balanceBy: ["type", "formality", "season"],
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        facet: true,
        summary: true,
        options: [
          "t-shirt",
          "shirt",
          "blouse",
          "sweater",
          "hoodie",
          "jacket",
          "coat",
          "dress",
          "skirt",
          "trousers",
          "jeans",
          "shorts",
          "suit",
          "activewear",
          "swimwear",
          "underwear",
          "sleepwear",
          "accessory",
          "other",
        ],
      },
      {
        key: "size",
        label: "Size",
        type: "text",
        summary: true,
        hint: "As printed on the label",
      },
      {
        key: "size_system",
        label: "Size system",
        type: "select",
        options: ["EU", "UK", "US", "INT", "JP"],
      },
      {
        key: "brand",
        label: "Brand",
        type: "text",
        facet: true,
        summary: true,
      },
      { key: "colors", label: "Colours", type: "multiselect", facet: true },
      { key: "material", label: "Material", type: "text" },
      { key: "pattern", label: "Pattern", type: "text" },
      {
        key: "season",
        label: "Season",
        type: "multiselect",
        facet: true,
        options: SEASONS,
      },
      {
        key: "formality",
        label: "Formality",
        type: "select",
        facet: true,
        options: ["loungewear", "casual", "smart-casual", "business", "formal"],
      },
      {
        key: "care",
        label: "Care",
        type: "text",
        hint: "Wash and care instructions",
      },
      { key: "fits_member", label: "Belongs to", type: "text" },
    ],
  },
  {
    slug: "shoes",
    label: "Shoes",
    icon: "👟",
    balanceBy: ["type", "season"],
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        facet: true,
        summary: true,
        options: [
          "sneakers",
          "running",
          "hiking",
          "boots",
          "chelsea-boots",
          "dress-shoes",
          "loafers",
          "sandals",
          "flip-flops",
          "heels",
          "flats",
          "slippers",
          "other",
        ],
      },
      { key: "size_eu", label: "Size (EU)", type: "text", summary: true },
      { key: "size_us", label: "Size (US)", type: "text" },
      {
        key: "brand",
        label: "Brand",
        type: "text",
        facet: true,
        summary: true,
      },
      { key: "colors", label: "Colours", type: "multiselect", facet: true },
      {
        key: "material",
        label: "Material",
        type: "text",
        hint: "Leather, suede, canvas, mesh…",
      },
      {
        key: "occasion",
        label: "Occasion",
        type: "select",
        facet: true,
        options: [
          "everyday",
          "sport",
          "outdoor",
          "work",
          "formal",
          "beach",
          "home",
        ],
      },
      {
        key: "season",
        label: "Season",
        type: "multiselect",
        facet: true,
        options: SEASONS,
      },
      { key: "fits_member", label: "Belongs to", type: "text" },
    ],
  },
  {
    slug: "electronics",
    label: "Electronics",
    icon: "🔌",
    balanceBy: ["device_type"],
    fields: [
      {
        key: "device_type",
        label: "Device",
        type: "select",
        facet: true,
        summary: true,
        options: [
          "laptop",
          "tablet",
          "phone",
          "monitor",
          "camera",
          "lens",
          "headphones",
          "speaker",
          "console",
          "router",
          "charger",
          "cable",
          "adapter",
          "power-bank",
          "drone",
          "smart-home",
          "appliance",
          "other",
        ],
      },
      {
        key: "brand",
        label: "Brand",
        type: "text",
        facet: true,
        summary: true,
      },
      { key: "model", label: "Model", type: "text", summary: true },
      {
        key: "serial",
        label: "Serial number",
        type: "text",
        hint: "Useful for insurance claims",
      },
      { key: "storage", label: "Storage", type: "text" },
      {
        key: "plug_type",
        label: "Plug type",
        type: "select",
        facet: true,
        options: [
          "Type-A",
          "Type-B",
          "Type-C",
          "Type-G",
          "Type-I",
          "Type-F",
          "USB-C",
          "none",
        ],
        hint: "Matters when the homes are in different countries",
      },
      {
        key: "voltage",
        label: "Voltage",
        type: "select",
        options: ["110V", "220-240V", "dual", "USB"],
      },
      {
        key: "cables_included",
        label: "Cables & accessories",
        type: "multiselect",
      },
      { key: "condition_notes", label: "Condition notes", type: "text" },
    ],
  },
  {
    slug: "kitchen",
    label: "Kitchen",
    icon: "🍳",
    balanceBy: ["type"],
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        facet: true,
        summary: true,
        options: [
          "cookware",
          "bakeware",
          "knife",
          "utensil",
          "small-appliance",
          "large-appliance",
          "crockery",
          "glassware",
          "cutlery",
          "storage",
          "other",
        ],
      },
      { key: "brand", label: "Brand", type: "text", facet: true },
      { key: "material", label: "Material", type: "text" },
      { key: "capacity", label: "Capacity / size", type: "text" },
      { key: "set_pieces", label: "Pieces in set", type: "number" },
    ],
  },
  {
    slug: "home",
    label: "Home & Tools",
    icon: "🛋️",
    balanceBy: ["type", "room"],
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        facet: true,
        summary: true,
        options: [
          "furniture",
          "linen",
          "towel",
          "bedding",
          "lighting",
          "decor",
          "rug",
          "tool",
          "cleaning",
          "garden",
          "luggage",
          "sports",
          "other",
        ],
      },
      {
        key: "room",
        label: "Room",
        type: "select",
        facet: true,
        options: [
          "bedroom",
          "living",
          "kitchen",
          "bathroom",
          "study",
          "outdoor",
          "storage",
        ],
      },
      { key: "brand", label: "Brand", type: "text" },
      { key: "material", label: "Material", type: "text" },
      { key: "dimensions", label: "Dimensions", type: "text" },
    ],
  },
  {
    slug: "documents",
    label: "Documents & Valuables",
    icon: "🔐",
    isPrivate: true,
    balanceBy: [],
    fields: [
      {
        key: "doc_type",
        label: "Type",
        type: "select",
        facet: true,
        summary: true,
        options: [
          "passport",
          "id-card",
          "certificate",
          "deed",
          "insurance",
          "contract",
          "tax",
          "medical",
          "jewellery",
          "watch",
          "heirloom",
          "other",
        ],
      },
      { key: "holder", label: "Belongs to", type: "text" },
      { key: "reference", label: "Reference number", type: "text" },
      { key: "issued_on", label: "Issued", type: "date" },
      {
        key: "stored_in",
        label: "Stored in",
        type: "text",
        hint: "Safe, drawer, deposit box…",
      },
    ],
  },
  {
    slug: "toys",
    label: "Toys & Kids",
    icon: "🧸",
    // Generic schema for now; a tailored one is in BACKLOG.md.
    balanceBy: ["type"],
    fields: [
      { key: "type", label: "Type", type: "text", facet: true, summary: true },
      { key: "brand", label: "Brand", type: "text", facet: true },
      { key: "colors", label: "Colours", type: "multiselect" },
    ],
  },
  {
    slug: "other",
    label: "Other",
    icon: "📦",
    balanceBy: ["type"],
    fields: [
      { key: "type", label: "Type", type: "text", facet: true, summary: true },
      { key: "brand", label: "Brand", type: "text", facet: true },
      { key: "colors", label: "Colours", type: "multiselect" },
    ],
  },
] as const;

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [
  string,
  ...string[],
];

export const CONDITION_VALUES = CONDITIONS;

const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: string | null | undefined): CategoryDef {
  return (slug && bySlug.get(slug)) || bySlug.get("other")!;
}

export type AttributeValue = string | number | string[];
export type Attributes = Record<string, AttributeValue>;

/**
 * Coerce whatever Claude returned into the shape this category declares.
 * Unknown keys are kept under `extra` rather than dropped — a wrong category
 * guess should not silently destroy real information the model saw.
 */
export function normaliseAttributes(
  slug: string,
  raw: Record<string, unknown> | null | undefined,
): Attributes {
  const category = getCategory(slug);
  const known = new Map(category.fields.map((f) => [f.key, f]));
  const out: Attributes = {};
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value === null || value === undefined || value === "") continue;

    const field = known.get(key);
    if (!field) {
      extra[key] = stringify(value);
      continue;
    }

    switch (field.type) {
      case "number": {
        const n = typeof value === "number" ? value : Number(stringify(value));
        if (Number.isFinite(n)) out[key] = n;
        break;
      }
      case "multiselect": {
        const list = Array.isArray(value)
          ? value.map(stringify)
          : [stringify(value)];
        const cleaned = list.map((s) => s.trim()).filter(Boolean);
        if (cleaned.length) out[key] = cleaned;
        break;
      }
      default:
        out[key] = stringify(value).trim();
    }
  }

  if (Object.keys(extra).length) out.extra = JSON.stringify(extra);
  return out;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringify).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Compact "Sneakers · Nike · 43" line under an item name. */
export function summaryLine(slug: string, attributes: Attributes): string {
  const category = getCategory(slug);
  return category.fields
    .filter((f) => f.summary)
    .map((f) => attributes[f.key])
    .filter((v): v is AttributeValue => v !== undefined && v !== "")
    .map((v) => (Array.isArray(v) ? v.join("/") : String(v)))
    .join(" · ");
}
