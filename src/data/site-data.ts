export const INSTAGRAM_URL = "https://www.instagram.com/hooksnthreads_official/";

export interface Category {
  slug: string;
  name: string;
  tagline: string;
  image: string;
}

export const categories: Category[] = [
  {
    slug: "forever-flowers",
    name: "Forever Flowers",
    tagline: "Crochet blooms that never wilt, in colours you choose.",
    image: "/images/marquee-a4.jpg",
  },
  {
    slug: "keychains",
    name: "Keychains",
    tagline: "Small companions for your keys, bags, and pockets.",
    image: "/images/product-bow-keychain.jpg",
  },
  {
    slug: "hair-accessories",
    name: "Hair Accessories",
    tagline: "Handmade pieces to dress up any hairstyle.",
    image: "/images/product-gajra.jpg",
  },
  {
    slug: "home-decor",
    name: "Home Decor",
    tagline: "Soft, stitched touches for shelves and tabletops.",
    image: "/images/product-sunflower-mirror.jpg",
  },
  {
    slug: "earrings",
    name: "Earrings",
    tagline: "Lightweight, handcrafted earrings for everyday wear.",
    image: "/images/carousel-earrings.jpg",
  },
];

export const navLinks = [
  { label: "Forever Flowers", href: "/category/forever-flowers" },
  { label: "Keychains", href: "/category/keychains" },
  { label: "Hair Accessories", href: "/category/hair-accessories" },
  { label: "Home Decor", href: "/category/home-decor" },
  { label: "Earrings", href: "/category/earrings" },
  { label: "Shop All", href: "/products" },
];

export interface Product {
  handle: string;
  title: string;
  price: number;
  image: string;
  category: string;
  featured?: boolean;
  created_at?: string;
}

export const products: Product[] = [
  // Forever Flowers
  {
    handle: "rose-flower",
    title: "Rose",
    price: 240,
    image: "/images/product-rose.jpg",
    category: "forever-flowers",
    featured: true,
  },
  {
    handle: "sunflower-bouquet",
    title: "Sunflower Bouquet",
    price: 1680,
    image: "/images/product-sunflower-bouquet.jpg",
    category: "forever-flowers",
    featured: true,
  },
  {
    handle: "lily",
    title: "Lily",
    price: 420,
    image: "/images/marquee-a1.jpg",
    category: "forever-flowers",
  },
  {
    handle: "tulip",
    title: "Tulip",
    price: 180,
    image: "/images/marquee-a2.jpg",
    category: "forever-flowers",
  },
  {
    handle: "calla-lily",
    title: "Calla Lily",
    price: 180,
    image: "/images/marquee-a3.jpg",
    category: "forever-flowers",
  },
  {
    handle: "rose-bouquet",
    title: "Rose Bouquet",
    price: 1200,
    image: "/images/marquee-a4.jpg",
    category: "forever-flowers",
  },

  // Keychains
  {
    handle: "bow-keychain",
    title: "Bow Keychain",
    price: 180,
    image: "/images/product-bow-keychain.jpg",
    category: "keychains",
    featured: true,
  },
  {
    handle: "evil-eye-keychain",
    title: "Evil Eye Keychain",
    price: 180,
    image: "/images/product-evil-eye-pouch.jpg",
    category: "keychains",
    featured: true,
  },
  {
    handle: "twin-daisies-keychain",
    title: "Twin Daisies",
    price: 180,
    image: "/images/marquee-b2.jpg",
    category: "keychains",
  },
  {
    handle: "heart-keychain",
    title: "Heart Keychain",
    price: 180,
    image: "/images/hero-custom-thumb.jpg",
    category: "keychains",
  },
  {
    handle: "donut-keychain",
    title: "Donut",
    price: 180,
    image: "/images/product-donut-keychain.jpg",
    category: "keychains",
  },
  {
    handle: "octopus-keychain",
    title: "Octopus",
    price: 180,
    image: "/images/product-octopus-keychain.jpg",
    category: "keychains",
  },

  // Hair Accessories
  {
    handle: "gajra",
    title: "Gajra",
    price: 360,
    image: "/images/product-gajra.jpg",
    category: "hair-accessories",
    featured: true,
  },
  {
    handle: "sunflower-gajra",
    title: "Sunflower Gajra",
    price: 360,
    image: "/images/product-sunflower-gajra.jpg",
    category: "hair-accessories",
  },
  {
    handle: "scrunchie",
    title: "Scrunchie",
    price: 160,
    image: "/images/guide-hair.jpg",
    category: "hair-accessories",
  },
  {
    handle: "rose-hairtie",
    title: "Rose Hairtie",
    price: 160,
    image: "/images/product-rose-hairtie.jpg",
    category: "hair-accessories",
  },
  {
    handle: "bow-hairtie",
    title: "Bow Hairtie",
    price: 120,
    image: "/images/product-bow-hairtie.jpg",
    category: "hair-accessories",
  },
  {
    handle: "flower-hairtie",
    title: "Flower Hairtie",
    price: 75,
    image: "/images/product-flower-hairtie.jpg",
    category: "hair-accessories",
  },

  // Home Decor
  {
    handle: "sunflower-mirror",
    title: "Sunflower Mirror",
    price: 2400,
    image: "/images/product-sunflower-mirror.jpg",
    category: "home-decor",
    featured: true,
  },
  {
    handle: "cushion",
    title: "Cushion",
    price: 1200,
    image: "/images/marquee-b3.jpg",
    category: "home-decor",
  },
  {
    handle: "coaster",
    title: "Coaster",
    price: 80,
    image: "/images/marquee-b4.jpg",
    category: "home-decor",
  },
  {
    handle: "table-runner",
    title: "Table Runner",
    price: 950,
    image: "/images/carousel-homedecor.jpg",
    category: "home-decor",
  },
  {
    handle: "jar-cover",
    title: "Jar Cover",
    price: 1200,
    image: "/images/guide-homedecor.jpg",
    category: "home-decor",
  },
  {
    handle: "waffle-coaster",
    title: "Waffle Coaster",
    price: 140,
    image: "/images/product-waffle-coaster.jpg",
    category: "home-decor",
  },

  // Earrings
  {
    handle: "flower-earring",
    title: "Flower Earring",
    price: 120,
    image: "/images/carousel-earrings.jpg",
    category: "earrings",
  },
  {
    handle: "sakura-earring",
    title: "Sakura Earring",
    price: 120,
    image: "/images/product-sakura-earring.jpg",
    category: "earrings",
  },
  {
    handle: "rose-earring",
    title: "Rose Earring",
    price: 120,
    image: "/images/product-rose-earring.jpg",
    category: "earrings",
  },
];

export const marqueeColumnA = [
  "/images/marquee-a1.jpg",
  "/images/marquee-a2.jpg",
  "/images/marquee-a3.jpg",
  "/images/marquee-a4.jpg",
];

export const marqueeColumnB = [
  "/images/marquee-b1.jpg",
  "/images/marquee-b2.jpg",
  "/images/marquee-b3.jpg",
  "/images/marquee-b4.jpg",
];

export interface CarouselCard {
  priceLabel: string;
  price: string;
  title: string;
  image: string;
  href: string;
}

export const carouselCards: CarouselCard[] = [
  {
    priceLabel: "Starting at",
    price: "₹180/piece",
    title: "Forever Flowers",
    image: "/images/carousel-flowers.jpg",
    href: "/category/forever-flowers",
  },
  {
    priceLabel: "Starting at",
    price: "₹65/piece",
    title: "Festive Specials",
    image: "/images/carousel-festive.jpg",
    href: "/#products",
  },
  {
    priceLabel: "Starting at",
    price: "₹80/piece",
    title: "Home Decor",
    image: "/images/carousel-homedecor.jpg",
    href: "/category/home-decor",
  },
  {
    priceLabel: "Starting at",
    price: "₹120/piece",
    title: "Earrings",
    image: "/images/carousel-earrings.jpg",
    href: "/category/earrings",
  },
];

export const faqs = [
  {
    question: "How do I place an order?",
    answer:
      "Browse the catalogue and note down the pieces you love, then send a DM on Instagram @hooksnthreads_official or a message on WhatsApp with the product, quantity, and colours you'd like. We'll confirm timing and pricing before you pay.",
  },
  {
    question: "What's the lead time on an order?",
    answer:
      "Every piece is made fresh once you order — nothing sits in inventory. Dispatch usually takes 7-14 days depending on the size and complexity of your order, and your piece arrives wrapped and ready in 1-2 weeks.",
  },
  {
    question: "Can I customize the colours?",
    answer:
      "Yes. Every design is fully customizable in colours that reflect your personal style — yarn shades can be matched on request, so just let us know what you have in mind when you message us.",
  },
  {
    question: "Do you ship across India?",
    answer:
      "Yes, we ship pan India. Once your piece is ready, it's carefully wrapped and dispatched via courier so it reaches you safely, wherever you are.",
  },
  {
    question: "How do I care for a handmade piece?",
    answer:
      "Our pieces are made with soft cotton blends. We recommend a gentle cold hand-wash and laying flat to dry to keep every stitch looking its best for years to come.",
  },
];

export interface GuideCard {
  category: string;
  description: string;
  image: string;
  href: string;
}

export const guides: GuideCard[] = [
  {
    category: "Forever Flowers",
    description:
      "Blooms that stay blooming — how to pick the right crochet flowers and bouquets for every occasion.",
    image: "/images/guide-flowers.jpg",
    href: "/category/forever-flowers",
  },
  {
    category: "Hair Accessories",
    description:
      "From gajras to scrunchies — the handmade hair pieces that turn an everyday look into main character energy.",
    image: "/images/guide-hair.jpg",
    href: "/category/hair-accessories",
  },
  {
    category: "Home Decor",
    description:
      "Soft touches for shelves, tables, and doorways — coasters, wind spinners, and cushions made stitch by stitch.",
    image: "/images/guide-homedecor.jpg",
    href: "/category/home-decor",
  },
  {
    category: "Custom Orders",
    description:
      "Have something specific in mind? Share a reference picture and we'll recreate it in colours, dimensions, and finishes to match.",
    image: "/images/guide-custom.jpg",
    href: "#how-to-order",
  },
];

export const scienceBadges = [
  { icon: "Rabbit", label: "100%\nHandcrafted" },
  { icon: "TreePine", label: "Soft Cotton\nYarn" },
  { icon: "Leaf", label: "Made\nTo Order" },
  { icon: "FlaskConical", label: "Custom\nColours" },
  { icon: "Atom", label: "Pan India\nShipping" },
  { icon: "Wheat", label: "Crafted\nWith Love" },
];

export interface FooterLink {
  label: string;
  href: string;
}

export const footerLinks: Record<string, FooterLink[]> = {
  Popular: [
    { label: "Forever Flowers", href: "/category/forever-flowers" },
    { label: "Keychains", href: "/category/keychains" },
    { label: "Hair Accessories", href: "/category/hair-accessories" },
    { label: "Home Decor", href: "/category/home-decor" },
    { label: "Earrings", href: "/category/earrings" },
  ],
  Company: [
    { label: "About the Maker", href: "/#about" },
    { label: "Custom Orders", href: "/#how-to-order" },
    { label: "Instagram", href: INSTAGRAM_URL },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Refund Policy", href: "/refund-policy" },
    { label: "Shipping Policy", href: "/shipping-policy" },
  ],
};
