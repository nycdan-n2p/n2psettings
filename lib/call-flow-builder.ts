/**
 * Build call flows from simplified schema.
 * Used by build_call_flow MCP tool.
 */

import type { AxiosInstance } from "axios";

interface WorkHoursInput {
  schedule?: { weekDays?: number[]; start?: string; end?: string };
  destination?: { type: "ring_group" | "department"; name: string };
}

interface AfterHoursInput {
  destination?: { type: "ring_group" | "department"; name: string };
}

interface NoAnswerInput {
  type?: "voicemail";
  target?: "department" | "user";
}

export interface BuildCallFlowArgs {
  main_number?: string;
  work_hours?: WorkHoursInput;
  after_hours?: AfterHoursInput;
  no_answer?: NoAnswerInput;
}

interface RingGroupMember {
  data: string;
  type: "user" | "department";
  rings: number;
  status: string;
  redirectToVoicemail: boolean;
  orderBy: number;
}

interface RingGroupTier {
  id: number;
  orderBy: number;
  status: string;
  members: RingGroupMember[];
}

interface RingGroupFinalTier {
  name: string;
  finalList: boolean;
  orderBy: number;
  status: string;
  members: RingGroupMember[];
}

interface RingGroupTimeBlock {
  id: number;
  name: string;
  type?: string;
  tier: RingGroupTier[];
  finalTier: RingGroupFinalTier;
  schedules?: number[];
}

function unwrap<T>(d: T): T {
  const v = d as { data?: T };
  return (v?.data !== undefined ? v.data : d) as T;
}

function makeMember(type: "user" | "department", id: string, orderBy: number): RingGroupMember {
  return {
    data: id,
    type,
    rings: 5,
    status: "A",
    redirectToVoicemail: false,
    orderBy,
  };
}

export async function buildCallFlow(
  v1: AxiosInstance,
  accountId: number,
  args: BuildCallFlowArgs
): Promise<{ success: boolean; message: string; created?: Record<string, unknown>; manualSteps?: string[] }> {
  const workHours = args.work_hours;
  const afterHours = args.after_hours;
  const noAnswer = args.no_answer;

  if (!workHours?.destination || !afterHours?.destination) {
    return {
      success: false,
      message: "Both workHours.destination and afterHours.destination are required.",
    };
  }

  const created: Record<string, unknown> = {};
  const manualSteps: string[] = [];

  try {
    // 1. Resolve entities
    const [rgRes, deptRes] = await Promise.all([
      v1.get(`/account/${accountId}/ringGroups`),
      v1.get(`/accounts/${accountId}/departments`),
    ]);

    const ringGroups = Array.isArray(unwrap(rgRes.data)) ? (unwrap(rgRes.data) as Array<{ id: string | number; name: string }>) : [];
    const departments = Array.isArray(unwrap(deptRes.data)) ? (unwrap(deptRes.data) as Array<{ deptId: number; name: string }>) : [];

    const findRg = (name: string) => ringGroups.find((r) => r.name?.toLowerCase() === name.toLowerCase());
    const findDept = (name: string) => departments.find((d) => d.name?.toLowerCase() === name.toLowerCase());

    const workDest = workHours.destination;
    const afterDest = afterHours.destination;

    let workMembers: RingGroupMember[] = [];
    let afterMembers: RingGroupMember[] = [];

    if (workDest.type === "ring_group") {
      const rg = findRg(workDest.name);
      if (!rg) return { success: false, message: `Ring group "${workDest.name}" not found.` };
      const detailRes = await v1.get(`/account/${accountId}/ringGroups/${rg.id}`);
      const detail = unwrap(detailRes.data) as { lines?: Array<{ lineId: string }> };
      const lines = detail?.lines ?? [];
      workMembers = lines.map((l, i) => makeMember("user", l.lineId, i + 1));
    } else {
      const dept = findDept(workDest.name);
      if (!dept) return { success: false, message: `Department "${workDest.name}" not found.` };
      workMembers = [makeMember("department", String(dept.deptId), 1)];
    }

    if (afterDest.type === "ring_group") {
      const rg = findRg(afterDest.name);
      if (!rg) return { success: false, message: `Ring group "${afterDest.name}" not found.` };
      const detailRes = await v1.get(`/account/${accountId}/ringGroups/${rg.id}`);
      const detail = unwrap(detailRes.data) as { lines?: Array<{ lineId: string }> };
      const lines = detail?.lines ?? [];
      afterMembers = lines.map((l, i) => makeMember("user", l.lineId, i + 1));
    } else {
      const dept = findDept(afterDest.name);
      if (!dept) return { success: false, message: `Department "${afterDest.name}" not found.` };
      afterMembers = [makeMember("department", String(dept.deptId), 1)];
    }

    // 2. Create schedule for work hours
    let workScheduleId: number | null = null;
    if (workHours.schedule?.weekDays?.length && workHours.schedule.start && workHours.schedule.end) {
      const schedulePayload = {
        name: "Work Hours",
        timezone: "EST",
        rules: [
          {
            days: {
              weekDays: workHours.schedule.weekDays,
              dates: null,
              isRange: false,
            },
            time: {
              start: workHours.schedule.start,
              end: workHours.schedule.end,
            },
          },
        ],
      };
      const schedRes = await v1.post(`/accounts/${accountId}/schedules`, schedulePayload);
      const sched = unwrap(schedRes.data) as { id?: number };
      workScheduleId = sched?.id ?? null;
      created.schedule = { id: workScheduleId, name: "Work Hours" };
    }

    // 3. Create ring group for routing
    const rgName = "Call Flow - Time-based Routing";
    const createRes = await v1.post(`/account/${accountId}/ringGroups`, { name: rgName });
    const newRg = unwrap(createRes.data) as { id: string | number };
    const rgId = newRg?.id;
    if (!rgId) return { success: false, message: "Failed to create ring group.", created };

    created.ringGroup = { id: rgId, name: rgName };

    // 4. Build timeBlock
    const emptyFinalTier: RingGroupFinalTier = {
      name: "Fallback",
      finalList: true,
      orderBy: 0,
      status: "A",
      members: [],
    };

    const workBlock: RingGroupTimeBlock = {
      id: -1,
      name: "Work Hours",
      type: "custom",
      tier: [
        {
          id: -1,
          orderBy: 1,
          status: "A",
          members: workMembers,
        },
      ],
      finalTier: noAnswer?.type === "voicemail" ? { ...emptyFinalTier, members: [] } : emptyFinalTier,
      schedules: workScheduleId != null ? [workScheduleId] : undefined,
    };

    const afterBlock: RingGroupTimeBlock = {
      id: -2,
      name: "After Hours",
      type: "allDay",
      tier: [
        {
          id: -2,
          orderBy: 1,
          status: "A",
          members: afterMembers,
        },
      ],
      finalTier: emptyFinalTier,
    };

    const timeBlock = [workBlock, afterBlock];

    // 5. Update ring group with timeBlock
    const currentRes = await v1.get(`/account/${accountId}/ringGroups/${rgId}`);
    const current = unwrap(currentRes.data) as Record<string, unknown>;
    await v1.put(`/account/${accountId}/ringGroups/${rgId}`, { ...current, timeBlock });

    manualSteps.push(
      `Assign your main number to ring group "${rgName}" (ID: ${rgId}) in the Phone Numbers page.`
    );
    if (noAnswer?.type === "voicemail") {
      manualSteps.push("Configure voicemail overflow in the ring group's Call Routing settings if needed.");
    }

    return {
      success: true,
      message: `Call flow created. Ring group "${rgName}" routes to ${workDest.name} during work hours and ${afterDest.name} after hours.`,
      created,
      manualSteps,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      message: `Call flow build failed: ${msg}`,
      created: Object.keys(created).length > 0 ? created : undefined,
      manualSteps,
    };
  }
}
