// Conversation history with a server-side source of truth when we have a
// per-user key (multi-tenant): transcripts live in AmpUp, scoped to the owner,
// so History syncs across devices. Without a key (single-org / local dev) it
// falls back to the per-browser localStorage store in data.jsx.
import { apiFetch, getMcpKey } from "./auth";
import {
  deleteConversation as deleteLocal,
  listConversations as listLocal,
  saveConversation as saveLocal,
} from "./data";

const serverBacked = () => !!getMcpKey();

export async function listConversations() {
  if (!serverBacked()) {
    return listLocal();
  }
  try {
    const res = await apiFetch("/api/conversations").then((r) => r.json());
    return Array.isArray(res.items) ? res.items : [];
  } catch {
    return listLocal();
  }
}

// Persist a conversation. Returns the AmpUp row id (ampupId) so the caller can
// thread it into subsequent saves (create on first save, update thereafter).
export async function saveConversation(convo) {
  if (!(convo && convo.id && Array.isArray(convo.messages)) || convo.messages.length === 0) {
    return convo?.ampupId;
  }
  if (!serverBacked()) {
    saveLocal(convo);
    return;
  }
  try {
    const res = await apiFetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ampupId: convo.ampupId,
        clientId: convo.id,
        runId: convo.runId,
        messages: convo.messages,
        deal_id: convo.dealId,
        account_id: convo.accountId,
      }),
    }).then((r) => r.json());
    return res?.ampupId ?? convo.ampupId;
  } catch {
    return convo.ampupId;
  }
}

// Accepts the full convo object (preferred — carries ampupId) or a bare id.
export async function deleteConversation(convo) {
  if (!serverBacked()) {
    deleteLocal(typeof convo === "string" ? convo : convo?.id);
    return;
  }
  const ampupId = typeof convo === "object" ? convo?.ampupId : convo;
  if (ampupId == null) {
    return;
  }
  try {
    await apiFetch(`/api/conversations/${ampupId}`, { method: "DELETE" });
  } catch {
    /* best-effort; the list refresh will reflect reality */
  }
}
