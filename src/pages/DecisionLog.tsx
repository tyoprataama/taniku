import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import { PageTransition } from "../components/ui/PageTransition";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import {
  decisions,
  fields,
  getSeasonsByField,
  getFieldName,
  addDecision,
  updateDecision,
  removeDecision,
  useDataVersion,
} from "../data";
import { formatDate } from "../utils/format";
import type { Decision, DecisionImpact } from "../types";
import type { BadgeTone } from "../components/ui/Badge";

const impactTone: Record<DecisionImpact, BadgeTone> = {
  high: "red",
  medium: "amber",
  low: "slate",
};
const impactLabel: Record<DecisionImpact, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};
const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const todayISO = () => new Date().toISOString().slice(0, 10);

interface FormValues {
  /** Tanggal keputusan — bisa dikustom (tidak lagi selalu hari ini). */
  date: string;
  fieldId: string;
  seasonId: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  impact: DecisionImpact;
  decidedBy: string;
  outcome: string;
}

const emptyForm = (fieldId: string): FormValues => ({
  date: todayISO(),
  fieldId,
  seasonId: "",
  title: "",
  context: "",
  decision: "",
  rationale: "",
  impact: "medium",
  decidedBy: "Tyo Pratama",
  outcome: "",
});

// Isi form dari record yang sedang diedit.
const formFrom = (d: Decision): FormValues => ({
  date: d.date ? d.date.slice(0, 10) : todayISO(),
  fieldId: d.fieldId ?? fields[0]?.id ?? "",
  seasonId: d.seasonId ?? "",
  title: d.title,
  context: d.context,
  decision: d.decision,
  rationale: d.rationale ?? "",
  impact: d.impact,
  decidedBy: d.decidedBy,
  outcome: d.outcome ?? "",
});

export default function DecisionLog() {
  useDataVersion();
  // Keputusan yang sedang diedit (null = mode tambah baru).
  const [editing, setEditing] = useState<Decision | null>(null);
  const { register, handleSubmit, reset, watch, formState } =
    useForm<FormValues>({
      defaultValues: emptyForm(fields[0]?.id ?? ""),
    });

  // Saat tombol edit diklik, muat nilainya ke form.
  useEffect(() => {
    reset(editing ? formFrom(editing) : emptyForm(fields[0]?.id ?? ""));
  }, [editing, reset]);

  const selectedFieldId = watch("fieldId");
  const seasonOptions = selectedFieldId
    ? getSeasonsByField(selectedFieldId)
    : [];

  const onSubmit = (values: FormValues) => {
    const payload = {
      date: values.date || todayISO(),
      fieldId: values.fieldId,
      seasonId: values.seasonId || undefined,
      title: values.title,
      context: values.context,
      decision: values.decision,
      rationale: values.rationale,
      impact: values.impact,
      decidedBy: values.decidedBy,
      outcome: values.outcome || undefined,
    };
    if (editing) {
      updateDecision(editing.id, payload);
      setEditing(null);
      return;
    }
    addDecision(payload);
    reset({ ...emptyForm(values.fieldId), decidedBy: values.decidedBy });
  };

  const onDelete = (d: Decision) => {
    if (
      !window.confirm(
        "Hapus keputusan ini? Tindakan ini tidak bisa dibatalkan.",
      )
    )
      return;
    if (editing?.id === d.id) setEditing(null);
    removeDecision(d.id);
  };

  const sorted = [...decisions].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );

  return (
    <PageTransition>
      <PageHeader
        title="Decision Log"
        description="Catatan keputusan operasional beserta konteks & alasannya. Tersimpan ke sumber data bersama."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">
              {editing ? "Edit Keputusan" : "Tambah Keputusan"}
            </h3>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <FiX size={13} /> Batal
              </button>
            ) : null}
          </div>
          {editing ? (
            <p className="mb-3 rounded-lg bg-tulus-50 px-3 py-2 text-xs text-tulus-700">
              Mengubah: <strong>{editing.title}</strong>
            </p>
          ) : null}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              label="Tanggal Keputusan"
              error={formState.errors.date?.message}
            >
              <input
                type="date"
                className={inputClass}
                {...register("date", { required: "Tanggal wajib diisi" })}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Lahan">
                <select className={inputClass} {...register("fieldId")}>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Musim (opsional)">
                <select className={inputClass} {...register("seasonId")}>
                  <option value="">— Tidak terkait —</option>
                  {seasonOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.year} · {s.crop}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Judul" error={formState.errors.title?.message}>
              <input
                className={inputClass}
                placeholder="Judul keputusan"
                {...register("title", { required: "Judul wajib diisi" })}
              />
            </FormField>
            <FormField
              label="Konteks"
              error={formState.errors.context?.message}
            >
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Situasi yang melatarbelakangi"
                {...register("context", { required: "Konteks wajib diisi" })}
              />
            </FormField>
            <FormField
              label="Keputusan"
              error={formState.errors.decision?.message}
            >
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Keputusan yang diambil"
                {...register("decision", { required: "Keputusan wajib diisi" })}
              />
            </FormField>
            <FormField label="Alasan">
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Alasan / pertimbangan"
                {...register("rationale")}
              />
            </FormField>
            <FormField label="Hasil (opsional)">
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Hasil setelah keputusan dijalankan"
                {...register("outcome")}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Dampak">
                <select className={inputClass} {...register("impact")}>
                  <option value="high">Tinggi</option>
                  <option value="medium">Sedang</option>
                  <option value="low">Rendah</option>
                </select>
              </FormField>
              <FormField label="Diputuskan oleh">
                <input className={inputClass} {...register("decidedBy")} />
              </FormField>
            </div>
            <Button type="submit" fullWidth>
              {editing ? "Simpan Perubahan" : "Simpan Keputusan"}
            </Button>
          </form>
        </Card>

        <div className="space-y-3">
          {sorted.length === 0 ? (
            <EmptyState title="Belum ada keputusan" />
          ) : (
            sorted.map((d) => (
              <Card
                key={d.id}
                className={`p-5 ${
                  editing?.id === d.id ? "ring-2 ring-tulus-400" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">{d.title}</h3>
                  <div className="flex items-center gap-2">
                    <Badge tone={impactTone[d.impact]}>
                      Dampak {impactLabel[d.impact]}
                    </Badge>
                    <button
                      onClick={() => setEditing(d)}
                      aria-label="Edit keputusan"
                      title="Edit keputusan"
                      className="rounded-lg p-1.5 text-tulus-600 ring-1 ring-tulus-200 transition hover:bg-tulus-50 hover:text-tulus-700"
                    >
                      <FiEdit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(d)}
                      aria-label="Hapus keputusan"
                      title="Hapus keputusan"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDate(d.date)} · {d.decidedBy}
                  {d.fieldId ? ` · ${getFieldName(d.fieldId)}` : ""}
                </p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Row label="Konteks" value={d.context} />
                  <Row label="Keputusan" value={d.decision} />
                  <Row label="Alasan" value={d.rationale} />
                  {d.outcome ? <Row label="Hasil" value={d.outcome} /> : null}
                </dl>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-medium text-slate-500">{label}:</dt>
      <dd className="text-slate-600">{value}</dd>
    </div>
  );
}
