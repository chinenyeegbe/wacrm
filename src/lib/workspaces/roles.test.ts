import { describe, it, expect } from "vitest";
import {
  can,
  canAssignRole,
  capabilitiesFor,
  isWorkspaceRole,
  roleAtLeast,
  roleRank,
  type WorkspaceRole,
} from "./roles";

describe("roleRank / roleAtLeast", () => {
  it("orders roles least → most powerful", () => {
    expect(roleRank("viewer")).toBeLessThan(roleRank("agent"));
    expect(roleRank("agent")).toBeLessThan(roleRank("operator"));
    expect(roleRank("operator")).toBeLessThan(roleRank("owner"));
  });

  it("roleAtLeast is inclusive", () => {
    expect(roleAtLeast("operator", "operator")).toBe(true);
    expect(roleAtLeast("owner", "agent")).toBe(true);
    expect(roleAtLeast("agent", "operator")).toBe(false);
  });
});

describe("capability inheritance", () => {
  it("viewer can only view the inbox", () => {
    expect(can("viewer", "inbox.view")).toBe(true);
    expect(can("viewer", "inbox.reply")).toBe(false);
    expect(can("viewer", "payments.configure")).toBe(false);
  });

  it("agent inherits viewer and adds front-line abilities", () => {
    expect(can("agent", "inbox.view")).toBe(true); // inherited
    expect(can("agent", "inbox.reply")).toBe(true);
    expect(can("agent", "payments.request")).toBe(true);
    expect(can("agent", "automations.manage")).toBe(false);
  });

  it("operator can run the workspace but not touch payments config or members", () => {
    expect(can("operator", "automations.manage")).toBe(true);
    expect(can("operator", "ai.configure")).toBe(true);
    expect(can("operator", "earnings.view")).toBe(true);
    expect(can("operator", "inbox.reply")).toBe(true); // inherited from agent
    expect(can("operator", "payments.configure")).toBe(false);
    expect(can("operator", "members.manage")).toBe(false);
  });

  it("owner can do everything", () => {
    const caps = capabilitiesFor("owner");
    expect(caps.has("payments.configure")).toBe(true);
    expect(caps.has("members.manage")).toBe(true);
    expect(caps.has("workspace.delete")).toBe(true);
    expect(caps.has("inbox.view")).toBe(true); // inherited all the way down
  });

  it("each step up is a strict superset of the one below", () => {
    const order: WorkspaceRole[] = ["viewer", "agent", "operator", "owner"];
    for (let i = 1; i < order.length; i++) {
      const lower = capabilitiesFor(order[i - 1]);
      const higher = capabilitiesFor(order[i]);
      for (const c of lower) expect(higher.has(c)).toBe(true);
      expect(higher.size).toBeGreaterThan(lower.size);
    }
  });
});

describe("canAssignRole — privilege-escalation guard", () => {
  it("owner can assign any role below owner", () => {
    expect(canAssignRole("owner", "operator")).toBe(true);
    expect(canAssignRole("owner", "agent")).toBe(true);
    expect(canAssignRole("owner", "viewer")).toBe(true);
  });

  it("owner cannot mint another owner via this path", () => {
    expect(canAssignRole("owner", "owner")).toBe(false);
  });

  it("operator cannot create operators or owners", () => {
    expect(canAssignRole("operator", "operator")).toBe(false);
    expect(canAssignRole("operator", "owner")).toBe(false);
  });

  it("agents and viewers cannot manage members at all", () => {
    expect(canAssignRole("agent", "viewer")).toBe(false);
    expect(canAssignRole("viewer", "viewer")).toBe(false);
  });
});

describe("isWorkspaceRole", () => {
  it("accepts valid roles and rejects junk", () => {
    expect(isWorkspaceRole("owner")).toBe(true);
    expect(isWorkspaceRole("agent")).toBe(true);
    expect(isWorkspaceRole("admin")).toBe(false);
    expect(isWorkspaceRole(null)).toBe(false);
    expect(isWorkspaceRole(42)).toBe(false);
  });
});
