import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { claimsFromAuthHeader, tokenFromAuthHeader } from "@/lib/server/jwt";

const V1_BASE = "https://app.net2phone.com/api";

function makeClient(token: string) {
  return axios.create({
    baseURL: V1_BASE,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: 30_000,
  });
}

// ── GET /api/porting — list existing porting onboards ────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = tokenFromAuthHeader(authHeader);
  if (!token) return NextResponse.json({ error: "Missing auth" }, { status: 401 });

  const accountId = claimsFromAuthHeader(authHeader)?.accountId ?? null;
  if (!accountId) return NextResponse.json({ error: "Token missing account ID" }, { status: 401 });

  const url = req.nextUrl;
  const onboardId = url.searchParams.get("onboardId");

  const api = makeClient(token);

  try {
    if (onboardId) {
      // Get signing links for a specific onboard
      const res = await api.get(`/accounts/${accountId}/porting/${onboardId}/sign/links`);
      return NextResponse.json({ data: res.data?.data ?? res.data });
    }
    // List all onboards
    const res = await api.get(`/accounts/${accountId}/porting/onboards`);
    return NextResponse.json({ data: res.data?.data ?? res.data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Porting GET failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST /api/porting — submit / update a porting request ────────────────────
//
// Body shape:
// {
//   numbers: string[];            // e.g. ["+12125551212"]
//   providerName: string;
//   accountNumber: string;
//   providerBtn: string;          // billing telephone number
//   pin: string;
//   targetPortDate: string;       // ISO date string, e.g. "2026-05-01"
//   contact: {                    // billing address & contact info
//     firstName, lastName, email, phone,
//     companyName, address1, address2, city, state, zip
//   }
// }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = tokenFromAuthHeader(authHeader);
  if (!token) return NextResponse.json({ error: "Missing auth" }, { status: 401 });

  const accountId = claimsFromAuthHeader(authHeader)?.accountId ?? null;
  if (!accountId) return NextResponse.json({ error: "Token missing account ID" }, { status: 401 });

  let body: {
    numbers: string[];
    providerName: string;
    accountNumber: string;
    providerBtn: string;
    pin: string;
    targetPortDate: string;
    contact: {
      firstName: string; lastName: string; email: string; phone: string;
      companyName: string; address1: string; address2: string;
      city: string; state: string; zip: string;
    };
    onboardId?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const api = makeClient(token);

  try {
    // Step 1: Get or find the existing onboard ID
    let onboardId = body.onboardId;
    if (!onboardId) {
      const listRes = await api.get(`/accounts/${accountId}/porting/onboards`);
      const onboards = listRes.data?.data ?? listRes.data ?? [];
      const list = Array.isArray(onboards) ? onboards : [];
      // Use the most recent pending/draft onboard, or take the first one
      const existing = list.find((o: Record<string, unknown>) =>
        ["Draft", "Pending", "New", "InvoiceUploaded"].includes(String(o.status ?? ""))
      ) ?? list[0];
      onboardId = existing?.id as number | undefined;
    }

    if (!onboardId) {
      return NextResponse.json({ error: "No existing porting onboard found. Please create one in the net2phone portal first, or contact support." }, { status: 400 });
    }

    // Step 2: Build the porting payload matching the net2phone API shape
    const phoneNumbers = body.numbers.map((num) => ({
      phoneNumber: num,
      secondPhoneNumber: null,
      status: null,
      confirmedFocDate: null,
      hasSecondNumber: false,
      isValid: true,
      error: "",
      secondError: "",
      inUsePendingNumbers: [],
    }));

    const payload = {
      id: onboardId,
      phoneNumbersModel: {
        requestedFocDate: null,
        confirmedFocDate: null,
        phoneNumbers,
        rangePhoneNumbers: phoneNumbers.map((p) => ({
          phoneNumber: p.phoneNumber,
          secondPhoneNumber: p.secondPhoneNumber,
          status: p.status,
          confirmedFocDate: p.confirmedFocDate,
          hasSecondNumber: p.hasSecondNumber,
          isValid: p.isValid,
          error: p.error,
          secondError: p.secondError,
        })),
      },
      targetPortDate: body.targetPortDate
        ? new Date(body.targetPortDate).toISOString()
        : null,
      onboardProvider: {
        numberTransferPin: body.pin,
        serviceProvider:   body.providerName,
        accountNumber:     body.accountNumber,
        providerBtn:       body.providerBtn,
      },
      onboardAddress: {
        companyName:        body.contact.companyName,
        contactPhoneNumber: body.contact.phone,
        firstName:          body.contact.firstName,
        lastName:           body.contact.lastName,
        email:              body.contact.email,
        address1:           body.contact.address1,
        address2:           body.contact.address2 || null,
        country:            null,
        city:               body.contact.city,
        state:              body.contact.state,
        zip:                body.contact.zip,
      },
    };

    const submitRes = await api.patch(`/accounts/${accountId}/porting/onboard`, payload);
    const submitted = submitRes.data?.data ?? submitRes.data;

    // Step 3: Get signing links
    let signLinks: { link: string; documentId: string }[] = [];
    try {
      const signRes = await api.get(`/accounts/${accountId}/porting/${onboardId}/sign/links`);
      signLinks = signRes.data?.data ?? signRes.data ?? [];
    } catch {
      // non-fatal — user can get links later
    }

    return NextResponse.json({
      data: {
        onboardId,
        status: submitted?.status ?? "Submitted",
        signLinks,
        signUrl: signLinks[0]?.link ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Porting submission failed";
    const axErr = e as { response?: { status?: number; data?: unknown } };
    const detail = axErr?.response?.data ? JSON.stringify(axErr.response.data) : undefined;
    return NextResponse.json({ error: msg, detail }, { status: 500 });
  }
}
