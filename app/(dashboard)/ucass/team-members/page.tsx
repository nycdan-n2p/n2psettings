"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import { fetchTeamMembers } from "@/lib/api/team-members";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

interface TeamMember {
  userId: number;
  firstName: string;
  lastName: string;
  extension: string;
  email: string;
  status: string;
  role: string;
  totalVMs?: number;
}

export default function TeamMembersPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["team-members", accountId],
    queryFn: () => fetchTeamMembers(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: "firstName",
      header: "Name",
      cell: ({ row }) =>
        `${row.original.firstName} ${row.original.lastName}`,
    },
    { accessorKey: "extension", header: "Extension" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "role", header: "Role" },
    {
      accessorKey: "totalVMs",
      header: "Voicemails",
      cell: ({ row }) => row.original.totalVMs ?? "—",
    },
    {
      id: "actions",
      header: "",
      cell: () => (
        <button className="p-1 hover:bg-gray-100 rounded">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Team Members
      </h1>
      <p className="text-gray-600 mb-6">
        Manage users and extensions for your account.
      </p>
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading team members..." />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchKey="email"
          searchPlaceholder="Search by name or email..."
        />
      )}
    </div>
  );
}
