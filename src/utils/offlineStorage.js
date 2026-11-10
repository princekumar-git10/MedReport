// Offline Medical Record (EMR) Vault using localStorage

const STORAGE_KEY = "medreport_offline_vault_v1";

export function getOfflineVault() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read offline vault:", e);
    return [];
  }
}

export function saveReportToVault(results, reportName = "Lab Report") {
  if (!results || results.length === 0) return null;
  try {
    const vault = getOfflineVault();
    const newRecord = {
      id: "rec_" + Date.now(),
      name: reportName,
      date: new Date().toISOString(),
      displayDate: new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      resultsCount: results.length,
      normalCount: results.filter(r => r.status === "normal").length,
      abnormalCount: results.filter(r => r.status !== "normal").length,
      urgentCount: results.filter(r => r.needsAttention).length,
      results: results,
    };

    // Keep up to 10 past offline reports
    const updated = [newRecord, ...vault.filter(v => v.name !== reportName)].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newRecord;
  } catch (e) {
    console.error("Failed to save to offline vault:", e);
    return null;
  }
}

export function deleteReportFromVault(id) {
  try {
    const vault = getOfflineVault();
    const updated = vault.filter(v => v.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to delete from offline vault:", e);
    return [];
  }
}

export function clearVault() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

