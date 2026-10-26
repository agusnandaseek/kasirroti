"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, RotateCcw, Save, Store, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { updateSettingsAction } from "./actions";
import type { BusinessHours, StoreSettingsView } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS = [
  { key: "1", label: "Senin" },
  { key: "2", label: "Selasa" },
  { key: "3", label: "Rabu" },
  { key: "4", label: "Kamis" },
  { key: "5", label: "Jumat" },
  { key: "6", label: "Sabtu" },
  { key: "0", label: "Minggu" },
];

const TIMEZONES = [
  { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB)" },
  { value: "Asia/Makassar", label: "Asia/Makassar (WITA)" },
  { value: "Asia/Jayapura", label: "Asia/Jayapura (WIT)" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "UTC", label: "UTC" },
];

type DayState = { key: string; label: string; closed: boolean; open: string; close: string };

function initialDays(hours: BusinessHours): DayState[] {
  return DAYS.map((day) => {
    const entry = hours[day.key] ?? { closed: true };
    return {
      key: day.key,
      label: day.label,
      closed: entry.closed,
      open: entry.open ?? "08:00",
      close: entry.close ?? "20:00",
    };
  });
}

export function SettingsForm({ settings }: { settings: StoreSettingsView }) {
  const router = useRouter();
  const [days, setDays] = useState<DayState[]>(() => initialDays(settings.businessHours));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateDay(key: string, patch: Partial<DayState>) {
    setDays((current) =>
      current.map((day) => (day.key === key ? { ...day, ...patch } : day)),
    );
    setSaved(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    const formData = new FormData(event.currentTarget);

    const businessHours: BusinessHours = {};
    for (const day of days) {
      businessHours[day.key] = day.closed
        ? { closed: true }
        : { closed: false, open: day.open, close: day.close };
    }
    formData.set("businessHours", JSON.stringify(businessHours));

    const result = await updateSettingsAction(null, formData);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    toast.success("Pengaturan toko disimpan.");
    router.refresh();
  }

  const openDays = days.filter((day) => !day.closed);

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="border-[3px] border-ink bg-paper shadow-hard-sm">
        <div className="flex items-center gap-3 border-b-[3px] border-ink p-4">
          <span className="flex size-9 items-center justify-center border-[3px] border-ink bg-butter">
            <Store className="size-4" strokeWidth={2.8} />
          </span>
          <div>
            <h2 className="text-lg uppercase leading-none">Identitas toko</h2>
            <p className="mt-1 text-[11px] text-muted">Tampil di halaman publik dan struk.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Nama toko" htmlFor="storeName" required>
            <Input
              id="storeName"
              name="storeName"
              defaultValue={settings.storeName}
              maxLength={100}
              required
            />
          </Field>

          <Field
            label="Zona waktu"
            htmlFor="timezone"
            required
            hint="Dipakai untuk jadwal, laporan, dan tampilan waktu."
          >
            <Input
              id="timezone"
              name="timezone"
              list="timezone-options"
              defaultValue={settings.timezone}
              placeholder="Asia/Jakarta"
              required
            />
            <datalist id="timezone-options">
              {TIMEZONES.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </datalist>
          </Field>
        </div>
      </section>

      <section className="border-[3px] border-ink bg-paper shadow-hard-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-ink p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center border-[3px] border-ink bg-butter">
              <Clock3 className="size-4" strokeWidth={2.8} />
            </span>
            <div>
              <h2 className="text-lg uppercase leading-none">Jam operasional</h2>
              <p className="mt-1 text-[11px] text-muted">
                {openDays.length} hari buka · tutup menonaktifkan tanggal tersebut dari pre-order.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y-2 divide-dotted divide-ink/20">
          {days.map((day) => (
            <div
              key={day.key}
              className={cn(
                "grid gap-3 px-4 py-3 sm:grid-cols-[110px_1fr_1fr_auto] sm:items-center",
                day.closed && "bg-cream/40",
              )}
            >
              <div className="flex items-center justify-between gap-2 sm:block">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                  {day.label}
                </p>
                <div className="sm:hidden">
                  <Checkbox
                    label="Tutup"
                    checked={day.closed}
                    onChange={(event) => updateDay(day.key, { closed: event.target.checked })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:contents">
                <label className="flex flex-col gap-1 text-[11px] sm:flex-row sm:items-center">
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    Buka
                  </span>
                  <Input
                    type="time"
                    value={day.open}
                    onChange={(event) => updateDay(day.key, { open: event.target.value })}
                    disabled={day.closed}
                    aria-label={`Jam buka ${day.label}`}
                    className="h-9 w-full text-xs disabled:bg-cream sm:w-28"
                  />
                </label>

                <label className="flex flex-col gap-1 text-[11px] sm:flex-row sm:items-center">
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    Tutup
                  </span>
                  <Input
                    type="time"
                    value={day.close}
                    onChange={(event) => updateDay(day.key, { close: event.target.value })}
                    disabled={day.closed}
                    aria-label={`Jam tutup ${day.label}`}
                    className="h-9 w-full text-xs disabled:bg-cream sm:w-28"
                  />
                </label>
              </div>

              <div className="hidden sm:block">
                <Checkbox
                  label="Tutup"
                  checked={day.closed}
                  onChange={(event) => updateDay(day.key, { closed: event.target.checked })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-[3px] border-ink bg-paper shadow-hard-sm">
        <div className="flex items-center gap-3 border-b-[3px] border-ink p-4">
          <span className="flex size-9 items-center justify-center border-[3px] border-ink bg-butter">
            <Clock3 className="size-4" strokeWidth={2.8} />
          </span>
          <div>
            <h2 className="text-lg uppercase leading-none">Slot pre-order</h2>
            <p className="mt-1 text-[11px] text-muted">
              Slot dibuat dari jam buka sampai menjelang tutup.
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field
            label="Interval slot (menit)"
            htmlFor="slotIntervalMinutes"
            required
            hint="Contoh: 30 menghasilkan slot 08:00, 08:30, 09:00, …"
          >
            <Select
              id="slotIntervalMinutes"
              name="slotIntervalMinutes"
              defaultValue={String(settings.slotIntervalMinutes)}
            >
              {[15, 30, 45, 60, 90, 120].map((value) => (
                <option key={value} value={value}>
                  {value} menit
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Lead time minimal (menit)"
            htmlFor="minPreorderMinutes"
            required
            hint="Jarak minimal dari sekarang sebelum slot bisa dipilih."
          >
            <Input
              id="minPreorderMinutes"
              name="minPreorderMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={10080}
              step={15}
              defaultValue={settings.minPreorderMinutes}
              required
            />
          </Field>

          <div className="sm:col-span-2">
            <Checkbox
              name="manualQrisEnabled"
              label="Aktifkan QRIS manual di kasir"
              defaultChecked={settings.manualQrisEnabled}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              QRIS manual hanya mencatat metode pembayaran. Tidak ada verifikasi otomatis atau
              payment gateway. Jika mati, kasir hanya bisa memilih tunai.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 border-[3px] border-ink bg-[#fdeae6] px-3 py-2.5 text-xs font-semibold leading-relaxed text-danger"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="flex items-center gap-2 border-[3px] border-ink bg-mint-soft px-3 py-2.5 text-xs font-semibold">
          <Check className="size-4 text-mint" strokeWidth={3.5} />
          Pengaturan tersimpan. Halaman pre-order publik memakai aturan baru.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={pending}>
          <Save className="size-4" strokeWidth={3} />
          {pending ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDays(initialDays(settings.businessHours));
            setError(null);
            setSaved(false);
            toast.success("Perubahan lokal dibatalkan.");
          }}
          disabled={pending}
        >
          <RotateCcw className="size-4" strokeWidth={3} />
          Batalkan perubahan
        </Button>
      </div>
    </form>
  );
}
