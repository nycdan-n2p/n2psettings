"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Trash2, Plus, ExternalLink } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { fetchTeamMembers } from "@/lib/api/team-members";
import {
  createOnboard,
  uploadInvoice,
  fetchSignLinks,
  type PortingPhoneNumber,
  type OnboardProvider,
  type OnboardAddress,
  type PortingOnboard,
} from "@/lib/api/porting";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { Loader } from "@/components/ui/Loader";

const STEPS = [
  { id: 1, label: "LIST NUMBERS" },
  { id: 2, label: "ASSOCIATE NUMBERS" },
  { id: 3, label: "ADDITIONAL INFO" },
  { id: 4, label: "UPLOAD INVOICE" },
  { id: 5, label: "LOA" },
  { id: 6, label: "FINALIZATION" },
] as const;

function formatPhone(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return s;
}

export function PortingWizard({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const { bootstrap } = useApp();
  const queryClient = useQueryClient();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const [step, setStep] = useState(1);
  const [numbers, setNumbers] = useState<PortingPhoneNumber[]>([{ phoneNumber: "", isValid: true }]);
  const [associations, setAssociations] = useState<Record<number, number>>({});
  const [provider, setProvider] = useState<OnboardProvider>({
    serviceProvider: "",
    accountNumber: "",
    providerBtn: "",
    portBtn: true,
    numberTransferPin: "",
  });
  const [address, setAddress] = useState<OnboardAddress>({
    companyName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    firstName: bootstrap?.user?.firstName ?? "",
    lastName: bootstrap?.user?.lastName ?? "",
    email: bootstrap?.user?.email ?? "",
    contactPhoneNumber: "",
  });
  const [targetPortDate, setTargetPortDate] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [onboardId, setOnboardId] = useState<number | null>(null);
  const [signLink, setSignLink] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: qk.teamMembers.list(accountId),
    queryFn: () => fetchTeamMembers(accountId),
    enabled: !!accountId && step >= 2,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (onboardId) return { id: onboardId } as PortingOnboard;
      const phoneNumbers = numbers
        .filter((n) => n.phoneNumber.replace(/\D/g, "").length >= 10)
        .map((n, i) => ({
          phoneNumber: n.phoneNumber.startsWith("+") ? n.phoneNumber : `+1${n.phoneNumber.replace(/\D/g, "")}`,
          error: "",
          secondError: "",
          isValid: true,
          inUsePendingNumbers: [] as string[],
          associatedUserId: associations[i] || undefined,
        }));
      if (phoneNumbers.length === 0) throw new Error("Add at least one phone number");
      const d = targetPortDate ? new Date(targetPortDate) : new Date();
      d.setHours(0, 0, 0, 0);
      return createOnboard(accountId, {
        phoneNumbersModel: { phoneNumbers },
        targetPortDate: d.toISOString(),
        onboardProvider: provider,
        onboardAddress: address,
      });
    },
    onSuccess: (data) => {
      setOnboardId(data.id);
      setStep(4);
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      if (!onboardId || !invoiceFile) throw new Error("Upload invoice first");
      return uploadInvoice(accountId, onboardId, invoiceFile);
    },
    onSuccess: () => setStep(5),
  });

  const signLinksMutation = useMutation({
    mutationFn: async () => {
      if (!onboardId) throw new Error("No port request");
      const links = await fetchSignLinks(accountId, onboardId);
      return links[0]?.link ?? null;
    },
    onSuccess: (link) => {
      setSignLink(link);
      if (link) window.open(link, "_blank");
      setStep(6);
    },
  });

  const handleAddNumber = () => setNumbers((n) => [...n, { phoneNumber: "", isValid: true }]);
  const handleRemoveNumber = (i: number) => setNumbers((n) => n.filter((_, j) => j !== i));
  const handleNumberChange = (i: number, v: string) => {
    setNumbers((n) => {
      const next = [...n];
      next[i] = { ...next[i], phoneNumber: v, isValid: true };
      return next;
    });
  };

  const validNumbers = numbers.filter((n) => n.phoneNumber.replace(/\D/g, "").length >= 10);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Phone Number Porting" size="2xl">
      <div className="flex gap-6 min-h-[420px]">
        <div className="w-48 shrink-0 border-r border-gray-200 pr-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900">Request Phone Number Porting</span>
          </div>
          <ol className="space-y-2">
            {STEPS.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step === s.id ? "bg-[#1a73e8] text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {s.id}
                </span>
                <span className={step === s.id ? "text-[#1a73e8] font-medium" : "text-gray-500"}>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 min-w-0">
          {step === 1 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">LIST NUMBERS</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please list phone numbers that you want to be ported from your current phone service provider to net2phone.
                Make sure you have added the correct phone numbers, as once the porting request is submitted, there will be no way to modify the phone numbers.
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Total: {validNumbers.length}/1022
              </p>
              <div className="space-y-2 mb-4">
                {numbers.map((n, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="tel"
                      value={n.phoneNumber}
                      onChange={(e) => handleNumberChange(i, e.target.value)}
                      placeholder="+12125551212"
                      className="flex-1 px-3 py-2 border border-[#dadce0] rounded-md text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNumber(i)}
                      className="p-2 text-gray-500 hover:text-red-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddNumber}
                className="text-[#1a73e8] text-sm font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add a Phone Number
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">ASSOCIATE PORT NUMBERS</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please associate the numbers you wish to port with existing account numbers. These will remain active until porting completion.
                If needed, we&apos;ll provide temporary numbers during the process. <strong>Note:</strong> once porting completes, associated numbers will be removed from your account.
              </p>
              <p className="text-sm text-gray-500 mb-3">Total Port Numbers: {validNumbers.length} | Unassigned: 0</p>
              <div className="space-y-3">
                {validNumbers.map((n, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-sm font-medium w-32">{formatPhone(n.phoneNumber)}</span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={associations[i] ?? ""}
                      onChange={(e) => setAssociations((a) => ({ ...a, [i]: Number(e.target.value) || 0 }))}
                      className="flex-1 px-3 py-2 border border-[#dadce0] rounded-md text-sm"
                    >
                      <option value="">Select user...</option>
                      {users.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.firstName} {u.lastName} {u.extension ?? u.userId}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {validNumbers.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">Add numbers in step 1 first.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">ADDITIONAL INFORMATION</h3>
              <p className="text-sm text-gray-600 mb-4">
                To port your phone numbers from your current provider to net2phone, you need to fill out a form.
                Provide accurate information exactly as it appears on your current provider&apos;s invoice. Any discrepancies can cause the transfer to fail.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="Current Service Provider *" value={provider.serviceProvider} onChange={(v) => setProvider((p) => ({ ...p, serviceProvider: v }))} required />
                <TextInput label="Current Account Number *" value={provider.accountNumber} onChange={(v) => setProvider((p) => ({ ...p, accountNumber: v }))} required />
                <TextInput label="Number Transfer PIN" value={provider.numberTransferPin ?? ""} onChange={(v) => setProvider((p) => ({ ...p, numberTransferPin: v }))} />
                <TextInput label="Provider BTN" value={provider.providerBtn} onChange={(v) => setProvider((p) => ({ ...p, providerBtn: v }))} />
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="port-btn" checked={provider.portBtn} onChange={(e) => setProvider((p) => ({ ...p, portBtn: e.target.checked }))} className="rounded" />
                  <label htmlFor="port-btn" className="text-sm text-gray-700">Port the BTN</label>
                </div>
                <TextInput label="First Name *" value={address.firstName} onChange={(v) => setAddress((a) => ({ ...a, firstName: v }))} required />
                <TextInput label="Last Name *" value={address.lastName} onChange={(v) => setAddress((a) => ({ ...a, lastName: v }))} required />
                <TextInput label="Email Address *" value={address.email} onChange={(v) => setAddress((a) => ({ ...a, email: v }))} type="email" required />
                <TextInput label="Phone Number *" value={address.contactPhoneNumber} onChange={(v) => setAddress((a) => ({ ...a, contactPhoneNumber: v }))} type="tel" required />
                <TextInput label="Company Name *" value={address.companyName} onChange={(v) => setAddress((a) => ({ ...a, companyName: v }))} required />
                <TextInput label="ZIP *" value={address.zip} onChange={(v) => setAddress((a) => ({ ...a, zip: v }))} required />
                <TextInput label="Address Line 1 *" value={address.address1} onChange={(v) => setAddress((a) => ({ ...a, address1: v }))} required />
                <TextInput label="Address Line 2" value={address.address2 ?? ""} onChange={(v) => setAddress((a) => ({ ...a, address2: v }))} />
                <TextInput label="City *" value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} required />
                <TextInput label="State *" value={address.state} onChange={(v) => setAddress((a) => ({ ...a, state: v }))} required />
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Port Date *</label>
                  <input
                    type="date"
                    value={targetPortDate}
                    onChange={(e) => setTargetPortDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">UPLOAD INVOICE</h3>
              <p className="text-sm text-gray-600 mb-2">Please upload the latest invoice from your current phone provider.</p>
              <p className="text-xs text-gray-500 mb-4">Supported: .pdf, .png, .jpg, .jpeg | Max size: 2 MB</p>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#1a73e8]"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#1a73e8]"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-[#1a73e8]");
                  const f = e.dataTransfer.files[0];
                  if (f) setInvoiceFile(f);
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  id="invoice-upload"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="invoice-upload" className="cursor-pointer">
                  <p className="text-sm font-medium text-gray-700">Drag & Drop</p>
                  <p className="text-sm text-[#1a73e8] mt-1">or Browse File</p>
                </label>
                {invoiceFile && <p className="mt-2 text-sm text-gray-600">{invoiceFile.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <TextInput label="Company Name *" value={address.companyName} onChange={(v) => setAddress((a) => ({ ...a, companyName: v }))} required />
                <TextInput label="ZIP *" value={address.zip} onChange={(v) => setAddress((a) => ({ ...a, zip: v }))} required />
                <TextInput label="Address Line 1 *" value={address.address1} onChange={(v) => setAddress((a) => ({ ...a, address1: v }))} required />
                <TextInput label="City *" value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} required />
                <TextInput label="Address Line 2" value={address.address2 ?? ""} onChange={(v) => setAddress((a) => ({ ...a, address2: v }))} />
                <TextInput label="State *" value={address.state} onChange={(v) => setAddress((a) => ({ ...a, state: v }))} required />
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">LETTER OF AUTHORIZATION</h3>
              <p className="text-sm text-gray-600 mb-4">
                Sign the agreement, ensuring the name added is the business name and that the Business Signer Name and signature belong to the same person.
              </p>
              <button
                type="button"
                onClick={() => signLinksMutation.mutate()}
                disabled={signLinksMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50"
              >
                {signLinksMutation.isPending ? <Loader variant="inline" /> : "Open LOA to Sign"}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 6 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">FINALIZATION</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your porting request has been created. After signing the LOA, the request will be submitted for processing.
              </p>
              {signLink && (
                <a
                  href={signLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#1a73e8] text-sm font-medium hover:underline"
                >
                  Open LOA again <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              {step === 1 ? "CANCEL" : "BACK"}
            </button>
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={validNumbers.length === 0}
                className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50"
              >
                NEXT
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
              >
                NEXT
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => createMutation.mutate(undefined as never)}
                disabled={createMutation.isPending || !provider.serviceProvider || !provider.accountNumber || !address.firstName || !address.lastName || !address.email || !address.contactPhoneNumber || !address.companyName || !address.zip || !address.address1 || !address.city || !address.state || !targetPortDate}
                className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader variant="inline" /> : "NEXT"}
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={() => invoiceMutation.mutate(undefined as never)}
                disabled={invoiceMutation.isPending || !invoiceFile}
                className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50"
              >
                {invoiceMutation.isPending ? <Loader variant="inline" /> : "NEXT"}
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                onClick={() => signLinksMutation.mutate()}
                disabled={signLinksMutation.isPending}
                className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50"
              >
                {signLinksMutation.isPending ? <Loader variant="inline" /> : "NEXT"}
              </button>
            )}
            {step === 6 && (
              <button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: qk.porting.all(accountId) });
                  onSuccess?.();
                  onClose();
                }}
                className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
              >
                DONE
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
