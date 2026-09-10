import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { Gallery } from "@/components/product/gallery";
import { BuyBox } from "@/components/product/buy-box";
import { StickyBuyBar } from "@/components/product/sticky-buy-bar";
import { ShareRow } from "@/components/product/share-row";
import { SizeGuideContent } from "@/components/product/size-guide";
import { ProductCardTile } from "@/components/product/product-card";
import { CategoryView } from "@/components/shop/category-view";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Price } from "@/components/ui/price";
import { Badge } from "@/components/ui/badge";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/ui/layout";
import { finishes, motifs, site } from "@/config/site";
import { erp } from "@/lib/erp";
import { parseQuery } from "@/lib/erp/query";
import { availabilityLabel } from "@/lib/erp/types";
import { ogImageUrl } from "@/lib/cloudinary";
import { cartLineFor } from "@/lib/cart/line";
import { productEnquiryHref } from "@/lib/whatsapp";
import { isBuyable, isPreOrder } from "@/lib/erp/types";
import { headers } from "next/headers";
import { jsonLd } from "@/lib/json-ld";

/*
 * Product detail.
 *
 * Revalidated every 60 seconds, much tighter than the home page's five
 * minutes. This is the only page where a stale stock number costs real money:
 * a customer who orders something that sold out four minutes ago gets a refund
 * conversation instead of a parcel.
 */
export const revalidate = 60;

/*
 * ONE dynamic segment serving two kinds of page.
 *
 * /shop/bracelets is a category and /shop/silver-moon-waist-chain is a
 * product, and Next cannot route those separately: [slug] matches both, and a
 * sibling [category] at the same level is a build error. The alternative was a
 * separate prefix — /category/bracelets — which works but gives the shop two
 * different URL shapes for "browse this".
 *
 * So the slug is resolved as a CATEGORY FIRST and a product second. Category
 * wins because the taxonomy is closed and small: five slugs the owner
 * controls, guarded in migration 1008 against colliding with a route name.
 * Product slugs are open-ended, so letting them win would mean a piece
 * accidentally named "bracelets" could hide a whole category.
 *
 * Both branches live in their own component. This file only decides which.
 */
async function findCategory(slug: string) {
  return (await erp().getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;

  const category = await findCategory(slug);
  if (category) {
    return {
      title: category.name,
      description: category.blurb ?? site.description,
      alternates: { canonical: `/shop/${category.slug}` },
      openGraph: {
        type: "website",
        title: `${category.name} — ${site.name}`,
        description: category.blurb ?? site.description,
        url: `/shop/${category.slug}`,
      },
    };
  }

  const product = await erp().getProduct(slug);
  if (!product) return { title: "Not found" };

  const og = product.images[0] ? ogImageUrl(product.images[0].id) : null;
  const description =
    product.tagline ?? product.description ?? site.description;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/shop/${product.slug}`,
      /* Cloudinary composes the card from the product shot, so there is no
         separate OG asset to keep in sync. */
      images: og ? [{ url: og, width: 1200, height: 630 }] : undefined,
    },
  };
}

export default async function ShopSlugPage({
  params,
  searchParams,
}: PageProps<"/shop/[slug]">) {
  const { slug } = await params;

  /* The category branch. Returns before any of the product work below, so a
     category page does no product read and no nonce lookup. */
  const category = await findCategory(slug);
  if (category) {
    const client = erp();
    const [products, categories] = await Promise.all([
      client.getProducts({
        ...parseQuery(await searchParams),
        category: category.slug,
      }),
      client.getCategories(),
    ]);

    return (
      <CategoryView
        category={category}
        products={products}
        categories={categories}
      />
    );
  }

  /*
   * The nonce minted by src/proxy.ts for this request.
   *
   * Next applies the nonce to its OWN scripts automatically, but not to a
   * hand-written <script> like the JSON-LD below — that one has to carry it
   * or the strict script-src drops it, and the product loses its rich
   * result in Google.
   *
   * Reading headers() forces dynamic rendering, which costs nothing here:
   * this route is already dynamic (see the build output and the note in
   * proxy.ts). It would NOT be free on the home page, which is why the home
   * page is outside the proxy's matcher and its JSON-LD needs no nonce.
   */
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const client = erp();
  const product = await client.getProduct(slug);
  if (!product) notFound();

  const url = `${site.url}/shop/${product.slug}`;
  const finish = product.finish ? finishes[product.finish] : null;
  const motif = product.motif ? motifs[product.motif] : null;

  /* Two more from the same motif, so the page has somewhere to go that is not
     back. Falls back to anything else if the motif has only this piece. */
  const all = await client.getProducts({ sort: "featured" });
  const related = all
    .filter((p) => p.id !== product.id)
    .sort((a, b) => Number(b.motif === product.motif) - Number(a.motif === product.motif))
    .slice(0, 3);

  return (
    <>
      <Container className="py-6 sm:py-10">
        {/*
         * The middle crumb follows the PRODUCT's category now. It was
         * hardcoded to "Waist chains → /shop", which was true while that was
         * the only category and became a lie with five: a bracelet's
         * breadcrumb offered to take the customer back to waist chains.
         *
         * Falls back to a plain "Shop" link when a product has no category
         * yet — every product starts that way, and a trail reading
         * "Home / null / …" is worse than one crumb short.
         */}
        <Breadcrumbs
          className="mb-6"
          trail={[
            { label: "Home", href: "/" },
            product.category
              ? {
                  label: product.category.name,
                  href: `/shop/${product.category.slug}`,
                }
              : { label: "Shop", href: "/shop" },
            { label: product.name },
          ]}
        />

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* The gallery breaks the gutter on a phone so the images run
              edge-to-edge, which is how a jewellery shot wants to be seen. */}
          <div className="-mx-5 sm:mx-0">
            <Gallery
              images={product.images}
              name={product.name}
              sku={product.sku}
            />
          </div>

          <div className="lg:pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {motif && <Eyebrow>{motif.label}</Eyebrow>}
              {product.availability.state !== "in_stock" && (
                <Badge
                  tone={
                    product.availability.state === "low_stock" ? "fact" : "action"
                  }
                >
                  {availabilityLabel(product.availability)}
                </Badge>
              )}
            </div>

            <SectionHeading as="h1" size="m" className="mt-4">
              {product.name}
            </SectionHeading>

            {product.tagline && (
              <p className="text-stone mt-3 text-base">{product.tagline}</p>
            )}

            <div className="mt-6 flex items-center gap-4">
              <Price
                amount={product.price}
                compareAt={product.compareAtPrice}
                size="lg"
              />
              {finish && (
                <span className="text-stone flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="border-line-strong inline-block size-3 rounded-full border"
                    style={{ background: finish.swatch }}
                  />
                  {finish.label}
                </span>
              )}
            </div>

            <BuyBox product={product} url={url} />

            {/* Phone only. Its sentinel is this position in the document, so
                the bar appears exactly when the buy box scrolls off. */}
            <StickyBuyBar
              line={cartLineFor(product)}
              preOrder={isPreOrder(product)}
              buyable={isBuyable(product)}
              name={product.name}
              price={product.price}
              whatsappHref={productEnquiryHref(product, url)}
            />

            <Accordion.Root
              type="single"
              collapsible
              className="border-line mt-10 border-t"
              defaultValue="details"
            >
              {product.description && (
                <Panel value="details" title="Details">
                  <p className="leading-relaxed">{product.description}</p>
                  {product.materials && (
                    <p className="text-stone mt-4">{product.materials}</p>
                  )}
                  <p className="text-stone-soft mt-4 text-xs">
                    SKU {product.sku}
                  </p>
                </Panel>
              )}

              <Panel value="size" title="Length & fit">
                <SizeGuideContent lengthInches={product.lengthInches} />
              </Panel>

              <Panel value="care" title="Care">
                <ul className="text-stone list-disc space-y-2 pl-5 leading-relaxed">
                  <li>Take it off before a shower, the pool or the sea.</li>
                  <li>
                    Perfume and lotion dull plating faster than anything else —
                    put jewellery on last.
                  </li>
                  <li>
                    Wipe it with a dry cloth after wearing and keep it in the
                    pouch it arrives in.
                  </li>
                </ul>
              </Panel>

              <Panel value="returns" title="Delivery & returns">
                <p className="leading-relaxed">
                  We ship by Pathao, Steadfast or RedX with cash on delivery. If
                  a piece arrives damaged or is not what you ordered, message us
                  within 3 days with a photo and we replace it — we cover the
                  courier both ways.
                </p>
                <p className="text-stone mt-4 leading-relaxed">
                  For hygiene reasons we cannot take back body jewellery that
                  has been worn, unless it is faulty.{" "}
                  <Link
                    href="/shipping"
                    className="decoration-line-strong underline underline-offset-4 hover:decoration-rose"
                  >
                    Full policy
                  </Link>
                  .
                </p>
              </Panel>
            </Accordion.Root>

            <ShareRow url={url} title={product.name} className="mt-8" />
          </div>
        </div>
      </Container>

      {related.length > 0 && (
        <Section tone="sand" as="div" className="mt-8 sm:mt-16">
          <Container>
            <Eyebrow>You might also like</Eyebrow>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-10 sm:grid-cols-3 sm:gap-x-6">
              {related.map((item, index) => (
                <ProductCardTile
                  key={item.id}
                  product={item}
                  /* Two columns on a phone, three from sm up — so the third
                     card would sit alone on a half-empty row. Hide it there
                     rather than ending the page on an orphan. */
                  className={index === 2 ? "hidden sm:block" : undefined}
                />
              ))}
            </div>
          </Container>
        </Section>
      )}

      {/*
       * Product structured data. `availability` and `price` must match what the
       * page shows — Google penalises a mismatch, and a customer arriving from a
       * rich result expecting ৳250 is a worse outcome than no rich result.
       *
       * An unpriced product deliberately omits `offers` entirely rather than
       * claiming a price of 0.
       */}
      {/* Clearance for the fixed phone buy bar. By the time the reader is
          this far down the page the bar is always showing, so the space is
          never wasted — and without it the bar covers the first rows of the
          footer. */}
      <div aria-hidden className="h-20 lg:hidden" />

      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            sku: product.sku,
            description: product.description ?? product.tagline ?? undefined,
            brand: { "@type": "Brand", name: site.name },
            image: product.images
              .map((image) => ogImageUrl(image.id))
              .filter(Boolean),
            ...(product.price !== null && {
              offers: {
                "@type": "Offer",
                url,
                priceCurrency: "BDT",
                price: product.price,
                availability:
                  product.availability.state === "pre_order"
                    ? "https://schema.org/PreOrder"
                    : "https://schema.org/InStock",
                itemCondition: "https://schema.org/NewCondition",
              },
            }),
          }),
        }}
      />
    </>
  );
}

function Panel({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="border-line border-b">
      <Accordion.Header>
        <Accordion.Trigger className="group flex min-h-13 w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium">
          {title}
          <ChevronDown
            size={16}
            aria-hidden
            className="text-stone shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      {/* The height animation uses Radix's CSS variable rather than a fixed
          max-height, so a long panel does not clip. */}
      <Accordion.Content className="overflow-hidden text-sm data-[state=closed]:animate-[acc-up_240ms_var(--ease-out-soft)] data-[state=open]:animate-[acc-down_240ms_var(--ease-out-soft)]">
        <div className="pb-6">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
