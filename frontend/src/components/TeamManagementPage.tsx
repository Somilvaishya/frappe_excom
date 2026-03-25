import { useState, useEffect, useCallback } from "react";
import { useFrappePostCall, useFrappeGetCall } from "frappe-react-sdk";
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  Shield,
  UserPlus,
  Trash2,
  Crown,
  Lock,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface Team {
  name: string;
  team_name: string;
  description: string;
  member_count: number;
}

interface TeamMember {
  user: string;
  role: string;
  full_name: string;
  user_image: string;
}

function CreateTeamDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, desc: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Create Team</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Team Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Team"
              className="bg-zinc-800 border-zinc-700 text-white"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Description</label>
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
            Cancel
          </Button>
          <Button
            onClick={() => name.trim() && onCreate(name.trim(), desc.trim())}
            disabled={!name.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

interface UserOption {
  name: string;
  full_name: string;
  user_image: string;
}

function AddMemberDialog({
  teamName,
  onAdd,
  onClose,
}: {
  teamName: string;
  onAdd: (user: string, role: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("Member");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const { call: searchUsers } = useFrappePostCall("excom.excom.api.teams.search_users");

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers({ search, limit: 15 });
        setUsers((res as any)?.message || []);
      } catch {
        setUsers([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = (user: UserOption) => {
    setSelectedUser(user);
    setSearch("");
    setShowDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-1">Add Member</h2>
        <p className="text-xs text-zinc-400 mb-4">
          Add a user to <span className="text-zinc-300">{teamName}</span>
        </p>
        <div className="space-y-3">
          <div className="relative">
            <label className="text-xs text-zinc-400 mb-1 block">User</label>

            {selectedUser ? (
              <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                {selectedUser.user_image ? (
                  <img
                    src={selectedUser.user_image}
                    className="w-6 h-6 rounded-full object-cover"
                    alt=""
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-zinc-300">
                    {(selectedUser.full_name || selectedUser.name).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{selectedUser.full_name || selectedUser.name}</span>
                  <span className="text-xs text-zinc-500 ml-2">{selectedUser.name}</span>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search by name or email..."
                    className="bg-zinc-800 border-zinc-700 text-white pl-10"
                    autoFocus
                  />
                </div>

                {showDropdown && (
                  <div className="absolute left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 max-h-52 overflow-y-auto">
                    {users.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-zinc-500 text-center">
                        {search ? "No users found" : "Type to search users..."}
                      </div>
                    ) : (
                      users.map((u) => (
                        <button
                          key={u.name}
                          onClick={() => handleSelect(u)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-700/50 transition-colors text-left"
                        >
                          {u.user_image ? (
                            <img
                              src={u.user_image}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                              alt=""
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center text-xs text-zinc-300 shrink-0">
                              {(u.full_name || u.name).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{u.full_name || u.name}</p>
                            <p className="text-[11px] text-zinc-500 truncate">{u.name}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            >
              <option value="Member">Member</option>
              <option value="Manager">Manager</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
            Cancel
          </Button>
          <Button
            onClick={() => selectedUser && onAdd(selectedUser.name, role)}
            disabled={!selectedUser}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function TeamDetailView({
  team,
  onBack,
}: {
  team: Team;
  onBack: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { call: fetchMembers } = useFrappePostCall("excom.excom.api.teams.get_team_members");
  const { call: addMember } = useFrappePostCall("excom.excom.api.teams.add_team_member");
  const { call: removeMember } = useFrappePostCall("excom.excom.api.teams.remove_team_member");

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetchMembers({ team: team.name });
      setMembers((res as any)?.message || []);
    } catch {
      toast.error("Failed to load members");
    }
  }, [fetchMembers, team.name]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">{team.team_name}</h1>
              {team.description && (
                <p className="text-xs text-zinc-400">{team.description}</p>
              )}
            </div>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add Member
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-lg font-semibold text-zinc-300">{members.length}</span>
          <span className="text-xs text-zinc-500">members</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400 text-sm">No members yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">User</th>
                <th className="text-left px-6 py-3">Role</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.user}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      {m.user_image ? (
                        <img
                          src={m.user_image}
                          className="w-8 h-8 rounded-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300">
                          {(m.full_name || m.user).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-white">{m.full_name || m.user}</p>
                        <p className="text-xs text-zinc-500">{m.user}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        m.role === "Manager"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-zinc-700/50 text-zinc-300"
                      }`}
                    >
                      {m.role === "Manager" && <Crown className="w-3 h-3 inline mr-1" />}
                      {m.role}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={async () => {
                        await removeMember({ team: team.name, user: m.user });
                        toast.success("Member removed");
                        loadMembers();
                      }}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddDialog && (
        <AddMemberDialog
          teamName={team.team_name}
          onAdd={async (user, role) => {
            try {
              await addMember({ team: team.name, user, role });
              toast.success("Member added");
              setShowAddDialog(false);
              loadMembers();
            } catch {
              toast.error("Failed to add member");
            }
          }}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}

export function TeamManagementPage({
  onNavigateBack,
}: {
  onNavigateBack: () => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { call: fetchTeams } = useFrappePostCall("excom.excom.api.teams.get_all_teams");
  const { call: createTeam } = useFrappePostCall("excom.excom.api.teams.create_team");

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetchTeams({});
      setTeams((res as any)?.message || []);
    } catch {
      toast.error("Failed to load teams");
    }
  }, [fetchTeams]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  if (selectedTeam) {
    return (
      <TeamDetailView
        team={selectedTeam}
        onBack={() => {
          setSelectedTeam(null);
          loadTeams();
        }}
      />
    );
  }

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-blue-400" />
          <h1 className="text-lg font-semibold text-white">Teams</h1>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Team
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Shield className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400 text-sm">No teams yet</p>
            <p className="text-zinc-500 text-xs mt-1">
              Create teams to organize conversation access
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => {
              const isGeneral = team.name === "General";
              return (
                <button
                  key={team.name}
                  onClick={() => setSelectedTeam(team)}
                  className={`bg-zinc-900 border rounded-xl p-5 text-left hover:border-zinc-600 transition-colors group ${
                    isGeneral ? "border-amber-800/40" : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                        {team.team_name}
                      </h3>
                      {isGeneral && (
                        <span title="System team — cannot be deleted">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                      {team.member_count} members
                    </span>
                  </div>
                  {team.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2">{team.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showCreateDialog && (
        <CreateTeamDialog
          onCreate={async (name, desc) => {
            try {
              await createTeam({ team_name: name, description: desc });
              toast.success("Team created");
              setShowCreateDialog(false);
              loadTeams();
            } catch {
              toast.error("Failed to create team");
            }
          }}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
