"use server";

import { revalidatePath } from "next/cache";
import { getActionProfile } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { productSchema, productUpdateSchema } from "@/lib/validation/schemas";
import { actionFail, actionOk, type ActionResult, toActionError } from "@/lib/errors";

function refresh() {
  revalidatePath("/admin/products");
  revalidatePath("/cashier/pos");
  revalidatePath("/preorder");
  revalidatePath("/");
}

function readProductForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
    costPrice: formData.get("costPrice") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    stock: formData.get("stock") ?? "0",
    isAvailable: formData.get("isAvailable") ?? null,
  };
}

export async function createProductAction(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await getActionProfile(["admin"]);
    const parsed = productSchema.safeParse(readProductForm(formData));
    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data produk tidak valid.");
    }

    const { data, error } = await getAdminClient()
      .from("products")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        cost_price: parsed.data.costPrice,
        image_url: parsed.data.imageUrl,
        stock: parsed.data.stock,
        is_available: parsed.data.isAvailable,
      })
      .select("id")
      .single<{ id: string }>();

    if (error) throw error;
    refresh();
    return actionOk({ id: data.id });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function updateProductAction(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await getActionProfile(["admin"]);
    const parsed = productUpdateSchema.safeParse({
      ...readProductForm(formData),
      id: formData.get("id"),
    });

    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data produk tidak valid.");
    }

    const { error } = await getAdminClient()
      .from("products")
      .update({
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        cost_price: parsed.data.costPrice,
        image_url: parsed.data.imageUrl,
        stock: parsed.data.stock,
        is_available: parsed.data.isAvailable,
      })
      .eq("id", parsed.data.id);

    if (error) throw error;
    refresh();
    return actionOk({ id: parsed.data.id });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function toggleProductAvailabilityAction(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult<{ isAvailable: boolean }>> {
  try {
    await getActionProfile(["admin"]);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return actionFail("ID produk tidak valid.");

    const { error } = await getAdminClient()
      .from("products")
      .update({ is_available: isAvailable })
      .eq("id", id);

    if (error) throw error;
    refresh();
    return actionOk({ isAvailable });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function adjustProductStockAction(
  id: string,
  delta: number,
): Promise<ActionResult<{ stock: number; isAvailable: boolean }>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return actionFail("ID produk tidak valid.");
    if (!Number.isInteger(delta)) return actionFail("Perubahan stok tidak valid.");

    const { data, error } = await getAdminClient().rpc("adjust_product_stock", {
      p_product_id: id,
      p_delta: delta,
      p_actor: profile.id,
    });

    if (error) throw error;
    refresh();

    const result = data as { stock: number; is_available: boolean };
    return actionOk({
      stock: result.stock,
      isAvailable: result.is_available,
    });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function setProductStockAction(
  id: string,
  newStock: number,
): Promise<ActionResult<{ stock: number; isAvailable: boolean }>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return actionFail("ID produk tidak valid.");
    if (!Number.isInteger(newStock) || newStock < 0) return actionFail("Jumlah stok harus bilangan bulat positif.");

    const { data, error } = await getAdminClient().rpc("set_product_stock", {
      p_product_id: id,
      p_new_stock: newStock,
      p_actor: profile.id,
    });

    if (error) throw error;
    refresh();

    const result = data as { stock: number; is_available: boolean };
    return actionOk({
      stock: result.stock,
      isAvailable: result.is_available,
    });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}
