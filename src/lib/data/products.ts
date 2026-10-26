import "server-only";
import { cache } from "react";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ProductView } from "@/lib/types";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  cost_price: number | string | null;
  image_url: string | null;
  is_available: boolean;
};

function mapProduct(row: ProductRow): ProductView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    costPrice: row.cost_price == null ? null : Number(row.cost_price),
    imageUrl: row.image_url,
    isAvailable: row.is_available,
  };
}

export const listProducts = cache(async (options: { availableOnly?: boolean } = {}) => {
  let query = getAdminClient()
    .from("products")
    .select("id, name, description, price, cost_price, image_url, is_available")
    .order("name", { ascending: true });

  if (options.availableOnly) {
    query = query.eq("is_available", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat produk: ${error.message}`);

  return ((data ?? []) as ProductRow[]).map(mapProduct);
});

export const getProduct = cache(async (id: string) => {
  const { data, error } = await getAdminClient()
    .from("products")
    .select("id, name, description, price, cost_price, image_url, is_available")
    .eq("id", id)
    .maybeSingle<ProductRow>();

  if (error) throw new Error(`Gagal memuat produk: ${error.message}`);
  return data ? mapProduct(data) : null;
});

