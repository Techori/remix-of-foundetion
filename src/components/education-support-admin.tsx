import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Download, Eye, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { listEducationSupport, reviewEducationSupport } from "@/lib/education-support.functions";
import { applicationTypeKeys, applicationTypes, paymentStatuses, paymentStatusLabels, registrationStatuses, registrationStatusLabels, studentCategories, type ApplicationType, type StudentCategory } from "@/lib/education-support/rules";

const categoryLabels: Record<StudentCategory, string> = { school: "School", ug: "UG", pg: "PG" };
type Filters = { search: string; category: StudentCategory | ""; applicationType: ApplicationType | ""; paymentStatus: (typeof paymentStatuses)[number] | "" };
const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm";

function csvCell(v: unknown) { const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }

export function EducationSupportAdmin() {
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<Filters>({ search: "", category: "", applicationType: "", paymentStatus: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const list = useServerFn(listEducationSupport);
  const review = useServerFn(reviewEducationSupport);
  const queryClient = useQueryClient();
  const params = { page, ...(filters.search ? { search: filters.search } : {}), ...(filters.category ? { category: filters.category } : {}), ...(filters.applicationType ? { applicationType: filters.applicationType } : {}), ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}) };
  const query = useQuery({ queryKey: ["admin-education-support", params], queryFn: () => list({ data: params }) });
  const mutation = useMutation({
    mutationFn: (data: { id: string; status?: (typeof registrationStatuses)[number]; paymentStatus?: (typeof paymentStatuses)[number]; reason?: string }) => review({ data }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["admin-education-support"] }); toast.success("Registration updated."); },
    onError: e => toast.error(e.message),
  });
  const exportMutation = useMutation({
    mutationFn: () => list({ data: { ...params, page: 0, all: true } }),
    onSuccess: r => {
      const cols = Object.keys(r.rows[0] ?? { ack_number: "" });
      const csv = [cols.join(","), ...r.rows.map(row => cols.map(c => csvCell((row as Record<string, unknown>)[c])).join(","))].join("\n");
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `education-support-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    },
    onError: e => toast.error(e.message),
  });
  const row = query.data?.rows.find(r => r.id === selected);
  const setFilter = (patch: Partial<Filters>) => { setFilters(f => ({ ...f, ...patch })); setPage(0); setSelected(null); };

  return <section className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Education Support registrations</h2>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}><Download /> {exportMutation.isPending ? "Preparing…" : "Export CSV"}</Button>
        <Button variant="outline" size="icon" aria-label="Refresh education support registrations" onClick={() => query.refetch()}><RefreshCw /></Button>
      </div>
    </div>
    <form className="mt-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setFilter({ search: draft.trim() }); }}>
      <label className="sr-only" htmlFor="edu-admin-search">Search</label>
      <input id="edu-admin-search" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Acknowledgement no., name, mobile or email" className="h-9 min-w-64 flex-1 rounded-md border border-border bg-background px-3 text-sm" />
      <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search /></Button>
      <select aria-label="Student category" className={selectClass} value={filters.category} onChange={e => setFilter({ category: e.target.value as Filters["category"] })}><option value="">All categories</option>{studentCategories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select>
      <select aria-label="Applied for" className={selectClass} value={filters.applicationType} onChange={e => setFilter({ applicationType: e.target.value as Filters["applicationType"] })}><option value="">All applications</option>{applicationTypeKeys.map(k => <option key={k} value={k}>{applicationTypes[k].en}</option>)}</select>
      <select aria-label="Payment status" className={selectClass} value={filters.paymentStatus} onChange={e => setFilter({ paymentStatus: e.target.value as Filters["paymentStatus"] })}><option value="">All payments</option>{paymentStatuses.map(p => <option key={p} value={p}>{paymentStatusLabels[p]}</option>)}</select>
    </form>
    {query.error && <p role="alert" className="mt-4">{query.error.message}</p>}
    {query.isPending && <p className="mt-4">Loading registrations…</p>}
    <p className="mt-4 text-sm text-muted-foreground">{query.data?.count ?? 0} registrations · Payment status changes to confirmed only when you mark it after checking Razorpay.</p>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm">
      <thead className="border-b border-border bg-surface"><tr>{["Ack. no.", "Student", "Category", "Class / course", "Applied for", "Payment", "Status", ""].map(h => <th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr></thead>
      <tbody>{query.data?.rows.map(r => <tr key={r.id} className="border-b border-border">
        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold">{r.ack_number}</td>
        <td className="px-3 py-3">{r.student_name}<br /><span className="text-xs text-muted-foreground">{r.mobile}</span></td>
        <td className="px-3 py-3">{categoryLabels[r.student_category as StudentCategory] ?? r.student_category}</td>
        <td className="max-w-48 px-3 py-3">{r.current_class ? `Class ${r.current_class}` : r.course_name}<br /><span className="text-xs text-muted-foreground">{r.education_sector ?? ""}</span></td>
        <td className="px-3 py-3">{applicationTypes[r.application_type as ApplicationType]?.en ?? r.application_type}<br /><span className="text-xs text-muted-foreground">₹{r.registration_fee}</span></td>
        <td className="px-3 py-3 text-xs">{paymentStatusLabels[r.payment_status as keyof typeof paymentStatusLabels] ?? r.payment_status}{r.payment_reference && <><br /><span className="font-mono">{r.payment_reference}</span></>}</td>
        <td className="px-3 py-3 text-xs">{registrationStatusLabels[r.status as keyof typeof registrationStatusLabels] ?? r.status}</td>
        <td className="px-3 py-3"><Button variant="outline" size="icon" aria-label={`View ${r.ack_number}`} onClick={() => { setSelected(r.id); setReason(r.status_reason); }}><Eye /></Button></td>
      </tr>)}</tbody>
    </table></div>
    {!query.isPending && !query.error && query.data?.count === 0 && <p className="py-8 text-sm text-muted-foreground">No registrations yet.</p>}
    <div className="mt-4 flex items-center gap-3">
      <Button variant="outline" size="icon" aria-label="Previous registrations" disabled={page === 0} onClick={() => { setPage(page - 1); setSelected(null); }}><ChevronLeft /></Button>
      <span>Page {page + 1}</span>
      <Button variant="outline" size="icon" aria-label="Next registrations" disabled={(page + 1) * 20 >= (query.data?.count ?? 0)} onClick={() => { setPage(page + 1); setSelected(null); }}><ChevronRight /></Button>
    </div>

    {row && <div className="mt-8 border-t border-border pt-6">
      <h3 className="text-lg font-bold">{row.ack_number} · {row.student_name}</h3>
      <div className="mt-4 grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">Payment
          <select className={`${selectClass} mt-1 w-full`} value={row.payment_status} disabled={mutation.isPending} onChange={e => mutation.mutate({ id: row.id, paymentStatus: e.target.value as (typeof paymentStatuses)[number] })}>{paymentStatuses.map(p => <option key={p} value={p}>{paymentStatusLabels[p]}</option>)}</select>
        </label>
        <label className="text-sm font-semibold">Registration status
          <select className={`${selectClass} mt-1 w-full`} value={row.status} disabled={mutation.isPending} onChange={e => mutation.mutate({ id: row.id, status: e.target.value as (typeof registrationStatuses)[number], reason })}>{registrationStatuses.map(s => <option key={s} value={s}>{registrationStatusLabels[s]}</option>)}</select>
        </label>
        <form className="text-sm font-semibold" onSubmit={e => { e.preventDefault(); mutation.mutate({ id: row.id, status: row.status as (typeof registrationStatuses)[number], reason }); }}>Reason / note
          <div className="mt-1 flex gap-2"><input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} className="h-9 flex-1 rounded-md border border-border bg-background px-2 font-normal" /><Button type="submit" size="sm" variant="outline" disabled={mutation.isPending}>Save</Button></div>
        </form>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {([["Category", categoryLabels[row.student_category as StudentCategory]], ["Education", Object.entries((row.education ?? {}) as Record<string, string>).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ")], ["Education sector", row.education_sector ?? "—"], ["Father / mother", `${row.father_name} / ${row.mother_name}`], ["Date of birth", `${row.date_of_birth}${row.is_minor ? " (minor)" : ""}`], ["Gender / nationality", `${row.gender} / ${row.nationality}`], ["Mobile / WhatsApp", `${row.mobile} / ${row.whatsapp ?? "—"}`], ["Email", row.email], ["Permanent address", row.permanent_address], ["Current address", `${row.current_address}, ${row.city}, ${row.district}, ${row.state} – ${row.pin_code}`],
          ...(row.is_minor ? [["Guardian", `${row.guardian_name ?? "—"} (${row.guardian_relationship ?? "—"}) · ${row.guardian_mobile ?? ""} ${row.guardian_email ?? ""}`], ["Guardian consent", row.guardian_consent_at ? new Date(row.guardian_consent_at).toLocaleString("en-IN") : "—"]] : []),
          ["Coordinator", row.without_coordinator ? "Registered without a coordinator" : Object.entries((row.coordinator ?? {}) as Record<string, string>).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ")], ["Coordinator code", row.coordinator_code ?? "—"],
          ["Applied for", `${applicationTypes[row.application_type as ApplicationType]?.en ?? row.application_type} · ₹${row.registration_fee}`], ["Payment ID", row.payment_reference ? `${row.payment_reference} (${row.payment_reference_at ? new Date(row.payment_reference_at).toLocaleString("en-IN") : ""})` : "Not shared yet"], ["Registered", new Date(row.created_at).toLocaleString("en-IN")]] as [string, string][]).map(([k, v]) => <div key={k}><dt className="font-bold text-primary">{k}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words">{v}</dd></div>)}
      </dl>
    </div>}
  </section>;
}
