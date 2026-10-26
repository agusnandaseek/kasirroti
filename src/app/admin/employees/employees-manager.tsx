"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createEmployeeAction, updateEmployeeAction } from "./actions";
import { formatDate } from "@/lib/format";
import type { EmployeeView } from "@/lib/types";
import type { Role } from "@/lib/types";

export function EmployeesManager({
  employees,
  currentProfileId,
  timezone,
}: {
  employees: EmployeeView[];
  currentProfileId: string;
  timezone: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeView | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (employee) =>
        employee.fullName.toLowerCase().includes(term) ||
        employee.email.toLowerCase().includes(term),
    );
  }, [employees, query]);

  const activeAdmins = employees.filter(
    (employee) => employee.role === "admin" && employee.isActive,
  ).length;

  function openCreate() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(employee: EmployeeView) {
    setEditing(employee);
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    if (editing) formData.set("id", editing.id);

    const result = editing
      ? await updateEmployeeAction(null, formData)
      : await createEmployeeAction(null, formData);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    toast.success(editing ? "Data pegawai diperbarui." : "Akun pegawai dibuat.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="mint">
            <ShieldCheck className="size-3" strokeWidth={3} />
            {activeAdmins} admin aktif
          </Badge>
          <Badge tone="outline">{employees.length} akun</Badge>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-3.5" strokeWidth={3.5} />
          Tambah karyawan
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={3}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama atau email…"
          aria-label="Cari karyawan"
          className="h-10 pl-9 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border-[3px] border-dashed border-ink/35 bg-paper/60 px-4 py-14 text-center">
          <Users className="mx-auto size-8 text-muted" strokeWidth={2.4} />
          <p className="mt-3 text-sm font-bold">Pegawai tidak ditemukan</p>
          <p className="mt-1 text-xs text-muted">Ubah kata kunci atau tambahkan akun baru.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-[3px] border-ink bg-paper shadow-hard-sm">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr className="border-b-[3px] border-ink bg-cream/60 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                <th className="px-3 py-2.5 font-bold">Pegawai</th>
                <th className="px-3 py-2.5 font-bold">Peran</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Dibuat</th>
                <th className="px-3 py-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-dotted divide-ink/20">
              {filtered.map((employee) => {
                const initials = employee.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part.slice(0, 1).toUpperCase())
                  .join("");
                const isSelf = employee.id === currentProfileId;

                return (
                  <tr key={employee.id} className="align-middle transition hover:bg-cream/40">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center border-[3px] border-ink bg-butter-soft font-display text-xs">
                          {initials || <UserRound className="size-4" strokeWidth={2.6} />}
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold leading-tight">
                            {employee.fullName}
                            {isSelf ? (
                              <span className="border-2 border-ink bg-butter px-1 py-0 font-mono text-[8px] font-bold uppercase tracking-[0.1em]">
                                Kamu
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 break-all text-[11px] text-muted">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={employee.role === "admin" ? "ink" : "sky"}>
                        {employee.role === "admin" ? "Admin" : "Kasir"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={employee.isActive ? "mint" : "muted"}>
                        {employee.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] text-ink-soft">
                      {formatDate(employee.createdAt, timezone)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(employee)}
                        className="inline-flex items-center gap-1.5 border-2 border-ink bg-paper px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] transition hover:bg-butter"
                      >
                        <Pencil className="size-3" strokeWidth={3} />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-start gap-2 border-2 border-ink bg-butter-soft/60 px-3 py-2 text-[10px] leading-relaxed">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" strokeWidth={3} />
        <span>
          Minimal satu admin aktif harus selalu ada. Kamu tidak bisa menonaktifkan atau menurunkan
          peran akun sendiri. Akun nonaktif tidak bisa masuk ke area kasir maupun admin.
        </span>
      </div>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
              {editing ? "Ubah pegawai" : "Akun baru"}
            </p>
            <DialogTitle>{editing ? editing.fullName : "Tambah karyawan"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Email akun tidak dapat diubah. Perubahan peran dan status berlaku pada login berikutnya."
                : "Akun langsung aktif dan dapat dipakai masuk. Bagikan password awal secara aman."}
            </DialogDescription>
          </DialogHeader>

          <form key={editing?.id ?? "new"} onSubmit={submit} className="space-y-4">
            <Field label="Nama lengkap" htmlFor="fullName" required>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={editing?.fullName ?? ""}
                placeholder="Nama pegawai"
                maxLength={100}
                required
              />
            </Field>

            {editing ? (
              <Field label="Email" htmlFor="email-readonly">
                <Input id="email-readonly" value={editing.email} readOnly disabled />
              </Field>
            ) : (
              <Field label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  placeholder="nama@email.com"
                  autoComplete="off"
                  required
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Peran" htmlFor="role" required>
                <Select id="role" name="role" defaultValue={editing?.role ?? ("cashier" as Role)}>
                  <option value="cashier">Kasir</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>

              {editing ? (
                <div className="flex items-end pb-3">
                  <Checkbox
                    name="isActive"
                    label="Akun aktif"
                    defaultChecked={editing.isActive}
                  />
                </div>
              ) : (
                <Field label="Password awal" htmlFor="password" required>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Minimal 8 karakter"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      className="pr-9"
                      required
                    />
                    <KeyRound
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                      strokeWidth={2.8}
                    />
                  </div>
                </Field>
              )}
            </div>

            {editing && !editing.isActive ? (
              <p className="border-2 border-ink bg-cream px-3 py-2 text-[10px] leading-relaxed">
                Akun ini sedang nonaktif. Mengaktifkan kembali akan memulihkan akses sesuai peran.
              </p>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 border-[3px] border-ink bg-[#fdeae6] px-3 py-2 text-xs font-semibold leading-relaxed text-danger"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
                {error}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" loading={pending}>
                {editing ? "Simpan perubahan" : "Buat akun"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
