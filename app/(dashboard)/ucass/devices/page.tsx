"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchDevices,
  fetchDeviceExtensions,
  fetchSipRegistrations,
  fetchDeviceOrders,
  createDevice,
  deleteDevice,
  rebootDevice,
  type Device,
  type CreateDevicePayload,
} from "@/lib/api/devices";
import { Modal } from "@/components/settings/Modal";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import {
  Monitor, WifiOff, RefreshCw, Download, Upload, Plus,
  Trash2, ChevronLeft, ChevronRight, Package, ExternalLink,
  MapPin, User, Truck,
} from "lucide-react";

type Tab = "devices" | "orders";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function fmtMac(mac: string): string {
  const clean = mac.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (clean.length === 12) return clean.match(/.{2}/g)!.join(":");
  return mac.toUpperCase();
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function orderStatusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === "delivered") return "bg-green-100 text-green-700";
  if (s === "shipped")   return "bg-blue-100 text-blue-700";
  if (s === "underway")  return "bg-amber-100 text-amber-700";
  if (s === "pending")   return "bg-gray-100 text-gray-600";
  return "bg-gray-100 text-gray-600";
}

const PAGE_SIZE = 10;

// ── Orders tab ────────────────────────────────────────────────────────────────
function OrdersTab({ accountId }: { accountId: number }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["device-orders", accountId],
    queryFn: () => fetchDeviceOrders(accountId),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o) =>
      o.orderId.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q) ||
      (o.contact.firstName + " " + o.contact.lastName).toLowerCase().includes(q) ||
      o.address.city.toLowerCase().includes(q) ||
      o.address.state.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader variant="inline" label="Loading orders…" />
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-sm w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search orders…"
            className="w-full pl-9 pr-3 py-2 border border-[#dadce0] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-gray-50"
          />
        </div>
        <span className="text-xs text-gray-500">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
          <Package className="w-10 h-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">
            {search ? "No orders match your search" : "No active orders"}
          </p>
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[160px_1fr_1fr_140px_140px_120px] gap-4 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-[#f1f3f4]">
            <span>Order ID</span>
            <span>Contact</span>
            <span>Ship To</span>
            <span>Carrier</span>
            <span>Submitted</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#f1f3f4]">
            {paginated.map((order) => {
              const isExp = expanded === order.id;
              const contactName = `${order.contact.firstName} ${order.contact.lastName}`.trim();
              const addr = order.address;
              const addrLine = [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
              return (
                <div key={order.id}>
                  <button
                    onClick={() => setExpanded(isExp ? null : order.id)}
                    className="w-full grid grid-cols-[160px_1fr_1fr_140px_140px_120px] gap-4 px-4 py-3.5 hover:bg-[#f8f9fa] transition-colors text-left items-center"
                  >
                    {/* Order ID */}
                    <span className="text-sm font-medium text-[#1a73e8]">{order.orderId}</span>

                    {/* Contact */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(contactName)}`}>
                        {getInitials(contactName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{contactName}</p>
                        <p className="text-xs text-gray-400 truncate">{order.contact.email}</p>
                      </div>
                    </div>

                    {/* Ship To */}
                    <div className="min-w-0">
                      {addr.recipient && <p className="text-sm text-gray-700 truncate">{addr.recipient}</p>}
                      <p className="text-xs text-gray-400 truncate">{addrLine}</p>
                    </div>

                    {/* Carrier */}
                    <div className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">{order.shipping.shipper}</p>
                        <p className="text-xs text-gray-400">{order.shipping.method}</p>
                      </div>
                    </div>

                    {/* Submitted */}
                    <span className="text-sm text-gray-500">{fmtDate(order.submissionDate)}</span>

                    {/* Status */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${orderStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExp && (
                    <div className="bg-[#f8f9fa] border-t border-[#f1f3f4] px-6 py-4 grid grid-cols-3 gap-6">
                      {/* Shipping address */}
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Shipping Address
                        </p>
                        <p className="text-sm text-gray-700">{addr.recipient}</p>
                        <p className="text-sm text-gray-600">{addr.line1}</p>
                        {addr.line2 && <p className="text-sm text-gray-600">{addr.line2}</p>}
                        <p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.zip}</p>
                        <p className="text-sm text-gray-600">{addr.country}</p>
                      </div>

                      {/* Contact */}
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" /> Contact
                        </p>
                        <p className="text-sm text-gray-700">{contactName}</p>
                        <p className="text-sm text-gray-500">{order.contact.email}</p>
                        <p className="text-sm text-gray-500">{order.contact.phone}</p>
                      </div>

                      {/* Tracking */}
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" /> Tracking
                        </p>
                        {order.trackingList?.length ? (
                          order.trackingList.map((t) => (
                            <div key={t.id} className="mb-2">
                              <a
                                href={t.trackingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline font-medium"
                              >
                                {t.trackingNumber}
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <p className="text-xs text-gray-400">
                                {t.shipper} · Shipped {fmtDate(t.shippingDate)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">No tracking info</p>
                        )}
                        <div className="mt-2 pt-2 border-t border-[#e8eaed]">
                          <p className="text-xs text-gray-400">Accepted: {fmtDateTime(order.acceptanceDate)}</p>
                          <p className="text-xs text-gray-400">Submitted: {fmtDateTime(order.submissionDate)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-[#e8eaed] disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)}
                    className={`w-8 h-8 text-xs rounded-md ${i === page ? "bg-[#1a73e8] text-white font-medium" : "text-gray-600 hover:bg-[#e8eaed]"}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-[#e8eaed] disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("devices");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [rebootingMac, setRebootingMac] = useState<string | null>(null);
  const [form, setForm] = useState<CreateDevicePayload>({ macId: "", deviceTypeId: undefined, displayName: "" });

  // ── Data ──
  const { data: devices = [], isLoading } = useQuery({
    queryKey: qk.devices.list(accountId),
    queryFn: () => fetchDevices(accountId),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: extensions = [] } = useQuery({
    queryKey: ["device-extensions", accountId],
    queryFn: () => fetchDeviceExtensions(accountId),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sipRegs = [] } = useQuery({
    queryKey: ["sip-registrations", accountId],
    queryFn: () => fetchSipRegistrations(200),
    enabled: !!accountId,
    staleTime: 60 * 1000,
  });

  // Merge SIP status + extension data into devices
  const enriched = useMemo(() => {
    const sipMap = new Map<string, string>();
    for (const r of sipRegs) {
      const normalised = r.mac_address.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      sipMap.set(normalised, r.registration_status);
    }
    const extMap = new Map<string, typeof extensions[0]>();
    for (const e of extensions) {
      if (e.macId) extMap.set(e.macId.replace(/[^a-fA-F0-9]/g, "").toUpperCase(), e);
    }

    return devices.map((d) => {
      const macNorm = d.macId.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      const sipStatus = sipMap.has(macNorm)
        ? sipMap.get(macNorm) === "active" ? "registered" : "unregistered"
        : "unknown";
      const ext = extMap.get(macNorm);
      const assignedUser = d.assignedUser ?? (ext ? {
        userId: ext.userId,
        firstName: ext.firstName,
        lastName: ext.lastName,
        extension: ext.extension,
        displayName: ext.displayName,
      } : undefined);
      return { ...d, sipStatus, assignedUser } as Device;
    });
  }, [devices, sipRegs, extensions]);

  // Stats
  const totalCount      = enriched.length;
  const activeCount     = enriched.filter((d) => d.sipStatus === "registered").length;
  const unassignedCount = enriched.filter((d) => !d.assignedUser?.userId && !d.assignedUser?.displayName).length;

  // Filter + paginate
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return enriched;
    return enriched.filter((d) =>
      d.macId.toLowerCase().includes(q) ||
      (d.deviceType?.name ?? "").toLowerCase().includes(q) ||
      (d.assignedUser?.firstName ?? "").toLowerCase().includes(q) ||
      (d.assignedUser?.lastName ?? "").toLowerCase().includes(q) ||
      (d.assignedUser?.displayName ?? "").toLowerCase().includes(q)
    );
  }, [enriched, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Mutations ──
  const addMutation = useMutation({
    mutationFn: (p: CreateDevicePayload) => createDevice(accountId, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.devices.all(accountId) }); setAddOpen(false); setForm({ macId: "", displayName: "" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (macId: string) => deleteDevice(accountId, macId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.devices.all(accountId) }); setDeleteTarget(null); },
  });

  const handleReboot = async (macId: string) => {
    setRebootingMac(macId);
    try { await rebootDevice(accountId, macId); } catch { /* ignore */ }
    setRebootingMac(null);
  };

  const tabClass = (t: Tab) =>
    `pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
      tab === t ? "border-[#1a73e8] text-[#1a73e8]" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage all physical devices on your account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: qk.devices.all(accountId) })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50">
            <Download className="w-4 h-4" /> Bulk Download
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50">
            <Upload className="w-4 h-4" /> Bulk Upload
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-[#1a73e8] rounded-full hover:bg-[#1557b0]"
          >
            <Plus className="w-4 h-4" /> Add Desk Phone
          </button>
        </div>
      </div>

      {/* Search + stats (devices tab only) */}
      {tab === "devices" && (
        <div className="flex items-center gap-6 mb-4">
          <div className="relative w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search devices…"
              className="w-full pl-9 pr-3 py-2 border border-[#dadce0] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-gray-50"
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Total: <strong className="text-gray-900">{totalCount}</strong></span>
            <span className="text-gray-300">|</span>
            <span>Active: <strong className="text-green-600">{activeCount}</strong></span>
            <span className="text-gray-300">|</span>
            <span>Unassigned: <strong className="text-amber-600">{unassignedCount}</strong></span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-0">
        <nav className="flex gap-6">
          <button type="button" onClick={() => setTab("devices")} className={tabClass("devices")}>Devices</button>
          <button type="button" onClick={() => setTab("orders")} className={tabClass("orders")}>Orders</button>
        </nav>
      </div>

      <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm overflow-hidden">

        {/* ── DEVICES TAB ── */}
        {tab === "devices" && (
          <>
            {/* Info row */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/40">
              <p className="text-xs text-gray-500">
                Manage all physical devices, view model MAC addresses and their current assignments.
              </p>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[180px_1fr_200px_120px_180px_160px_auto] items-center gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Device Type</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">MAC Address</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned To</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Order ID</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SIP Information</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Last Sync</span>
              <span className="w-20" />
            </div>

            {/* Rows */}
            {isLoading ? (
              <div className="py-16 flex justify-center">
                <Loader variant="inline" label="Loading devices…" />
              </div>
            ) : pageItems.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                <Monitor className="w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">{search ? "No devices match your search" : "No devices found"}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pageItems.map((device) => {
                  const user = device.assignedUser;
                  const userName = user?.displayName ?? (user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : null);
                  const initials = userName ? getInitials(userName) : null;
                  const color = userName ? avatarColor(userName) : "bg-gray-100 text-gray-400";
                  const registered = device.sipStatus === "registered";
                  const unknown = device.sipStatus === "unknown";
                  const isRebooting = rebootingMac === device.macId;

                  return (
                    <div
                      key={device.macId}
                      className="group grid grid-cols-[180px_1fr_200px_120px_180px_160px_auto] items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
                    >
                      {/* Device type */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-800 truncate">{device.deviceType?.name ?? "Unknown"}</span>
                      </div>

                      {/* MAC */}
                      <span className="text-sm font-mono text-gray-600">{fmtMac(device.macId)}</span>

                      {/* Assigned to */}
                      <div className="flex items-center gap-2 min-w-0">
                        {userName ? (
                          <>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${color}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 truncate">{userName}</p>
                              {user?.extension && <p className="text-xs text-gray-400">{user.extension}</p>}
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Unassigned</span>
                        )}
                      </div>

                      {/* Order ID */}
                      <span className="text-sm text-gray-500">{device.orderId ? String(device.orderId) : "—"}</span>

                      {/* SIP */}
                      <div className="flex items-center gap-2">
                        {unknown ? (
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <WifiOff className="w-3.5 h-3.5" /> Unknown
                          </span>
                        ) : registered ? (
                          <span className="flex items-center gap-1.5 text-xs text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                            Registered
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                            Not registered
                          </span>
                        )}
                        <button className="text-xs text-[#1a73e8] hover:underline">Details</button>
                      </div>

                      {/* Last sync */}
                      <span className="text-xs text-gray-500">{fmtDateTime(device.lastSyncDate)}</span>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-20 justify-end">
                        {registered && (
                          <button
                            onClick={() => handleReboot(device.macId)}
                            disabled={isRebooting}
                            className="text-xs text-[#1a73e8] hover:underline disabled:opacity-50 mr-1"
                            title="Reboot device"
                          >
                            {isRebooting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Reboot"}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(device)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remove device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => setPage(i)}
                      className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${i === page ? "bg-[#1a73e8] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50 disabled:opacity-40">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && <OrdersTab accountId={accountId} />}
      </div>

      {/* Add Device Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Desk Phone">
        <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(form); }}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">MAC Address <span className="text-red-500">*</span></label>
            <input type="text" value={form.macId} required
              onChange={(e) => setForm((f) => ({ ...f, macId: e.target.value }))}
              placeholder="e.g. AA:BB:CC:DD:EE:FF"
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
            <input type="text" value={form.displayName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="e.g. Reception Desk"
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]" />
          </div>
          {addMutation.isError && (
            <p className="text-sm text-red-600 mb-3">{(addMutation.error as Error)?.message ?? "Failed to add device"}</p>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={addMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">
              {addMutation.isPending ? "Adding…" : "Add Device"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.macId)}
        title="Remove Device"
        message={`Remove device ${deleteTarget ? fmtMac(deleteTarget.macId) : ""}? This cannot be undone.`}
      />
    </div>
  );
}
