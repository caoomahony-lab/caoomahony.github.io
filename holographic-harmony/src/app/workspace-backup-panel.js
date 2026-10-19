import { exportWorkspace, restoreWorkspace, MAX_BACKUP_BYTES } from "../model/workspace-backup.js";
import { browserStorage } from "./browser-storage.js";
export function downloadArtifact(value, filename, type = "application/json") {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function workspaceBackupPanel(onRestore = () => {}, storage = browserStorage()) {
  const root = document.createElement("details"); root.className = "fingerprint-custom workspace-backup";
  const summary = document.createElement("summary"); summary.textContent = "Back up or restore saved work";
  const note = document.createElement("p"); note.textContent = "Backs up saved libraries, passage sketches, settings and personal annotations. Keep original music files separately. Restoration adds absent records and refuses conflicting records; it never replaces existing work.";
  const status = document.createElement("p"); status.setAttribute("aria-live", "polite");
  const save = document.createElement("button"); save.type = "button"; save.textContent = "Download workspace backup";
  save.onclick = () => { try { downloadArtifact(exportWorkspace(storage), "Harmonic_Workspace_Backup.json"); status.textContent = "Backup downloaded. It can contain personal annotations; keep it private."; } catch(error) { status.textContent = `Could not back up: ${error.message}`; } };
  const restore = document.createElement("button"); restore.type = "button"; restore.textContent = "Restore workspace backup";
  const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json"; input.hidden = true;
  restore.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0]; input.value = ""; if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new RangeError("Backup exceeds 20 MiB");
      const result = restoreWorkspace(storage, await file.text());
      status.textContent = `Restored ${result.restored} records; ${result.unchanged} unchanged. Saved work is available; reload to refresh all settings.`;
      onRestore();
    } catch(error) { status.textContent = `Could not restore: ${error.message}`; }
  };
  root.append(summary,note,save,restore,input,status); return root;
}
