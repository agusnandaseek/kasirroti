import { describe, expect, it } from "vitest";
import {
  mapOrder,
  mapOrderDetail,
  mapOrderItems,
  type OrderDetailRow,
  type OrderRow,
} from "@/lib/data/mappers";

const baseRow: OrderRow = {
  id: "66666666-6666-4666-8666-666666666666",
  order_code: "PO-000001",
  order_type: "pre_order",
  order_status: "pending_confirmation",
  payment_status: "unpaid",
  customer_name: "Rina Putri",
  customer_email: "pelanggan@contoh.com",
  customer_phone: "081234567890",
  pickup_at: "2026-10-26T02:00:00.000Z",
  total_amount: "75000",
  created_at: "2026-10-26T00:00:00.000Z",
  confirmed_at: null,
  queued_at: null,
  completed_at: null,
  cancellation_reason: null,
  queue_priority: false,
  order_items: [
    {
      product_id: "11111111-1111-4111-8111-111111111111",
      product_name: "Roti Cokelat",
      quantity: 2,
      unit_price: "25000",
      subtotal: "50000",
    },
    {
      product_id: "22222222-2222-4222-8222-222222222222",
      product_name: "Bolu Pandan",
      quantity: 1,
      unit_price: 25000,
      subtotal: 25000,
    },
  ],
};

describe("mapOrderItems", () => {
  it("sorts items by name and normalizes numeric strings", () => {
    const items = mapOrderItems(baseRow.order_items);

    expect(items.map((item) => item.productName)).toEqual(["Bolu Pandan", "Roti Cokelat"]);
    expect(items[0]).toEqual({
      productId: "22222222-2222-4222-8222-222222222222",
      productName: "Bolu Pandan",
      quantity: 1,
      unitPrice: 25000,
      unitCost: null,
      subtotal: 25000,
    });
  });

  it("handles missing items", () => {
    expect(mapOrderItems(null)).toEqual([]);
    expect(mapOrderItems(undefined)).toEqual([]);
  });
});

describe("mapOrder", () => {
  it("normalizes totals and preserves status fields", () => {
    const order = mapOrder(baseRow);

    expect(order.id).toBe(baseRow.id);
    expect(order.code).toBe("PO-000001");
    expect(order.trackingCode).toBeNull();
    expect(order.type).toBe("pre_order");
    expect(order.status).toBe("pending_confirmation");
    expect(order.paymentStatus).toBe("unpaid");
    expect(order.customerName).toBe("Rina Putri");
    expect(order.totalAmount).toBe(75000);
    expect(typeof order.totalAmount).toBe("number");
    expect(order.queuePriority).toBe(false);
    expect(order.cashierName).toBeNull();
    expect(order.items).toHaveLength(2);
  });

  it("maps the queue priority flag", () => {
    const order = mapOrder({ ...baseRow, order_status: "queued", queue_priority: true });

    expect(order.queuePriority).toBe(true);
  });

  it("maps the cashier who recorded the payment", () => {
    const order = mapOrder({
      ...baseRow,
      payment_status: "paid",
      payments: {
        amount: "75000",
        payment_method: "cash",
        paid_at: "2026-10-26T03:00:00.000Z",
        profiles: { full_name: "Sari Admin" },
      },
    });

    expect(order.cashierName).toBe("Sari Admin");
  });
});

describe("mapOrderDetail", () => {
  it("sorts history ascending and normalizes payment amount", () => {
    const row: OrderDetailRow = {
      ...baseRow,
      payments: {
        amount: "75000",
        payment_method: "cash",
        paid_at: "2026-10-26T03:00:00.000Z",
      },
      order_status_history: [
        {
          id: "b",
          from_status: "confirmed",
          to_status: "queued",
          actor_type: "cashier",
          notes: null,
          changed_at: "2026-10-26T02:30:00.000Z",
        },
        {
          id: "a",
          from_status: null,
          to_status: "pending_confirmation",
          actor_type: "guest",
          notes: "Pre-order dibuat pelanggan",
          changed_at: "2026-10-26T00:00:00.000Z",
        },
      ],
    };

    const detail = mapOrderDetail(row);

    expect(detail.history.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(detail.payment).toEqual({
      amount: 75000,
      payment_method: "cash",
      paid_at: "2026-10-26T03:00:00.000Z",
    });
  });

  it("handles a missing payment and empty history", () => {
    const detail = mapOrderDetail({ ...baseRow, payments: [], order_status_history: null });

    expect(detail.payment).toBeNull();
    expect(detail.history).toEqual([]);
  });

  it("accepts the first payment when PostgREST returns an array", () => {
    const detail = mapOrderDetail({
      ...baseRow,
      payments: [
        { amount: 75000, payment_method: "manual_qris", paid_at: "2026-10-26T03:00:00.000Z" },
      ],
    });

    expect(detail.payment?.payment_method).toBe("manual_qris");
  });
});
