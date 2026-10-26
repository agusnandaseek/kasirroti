import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { listProducts } from "@/lib/data/products";
import { ProductsManager } from "./products-manager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireRole(["admin"]);
  const products = await listProducts();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Katalog"
        title="Produk"
      />
      <ProductsManager products={products} />
    </div>
  );
}
