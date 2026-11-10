import { useState } from "react";
import sampleBills from "../data/sampleBills.json";
import { useLanguage } from "../context/LanguageContext";

export default function BillComparator() {
  const [bills, setBills] = useState(sampleBills);
  const [selectedBillId, setSelectedBillId] = useState(sampleBills[0].id);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const { t } = useLanguage();

  // Custom bill modal state
  const [customProc, setCustomProc] = useState("");
  const [customHosp, setCustomHosp] = useState("");
  const [customEst, setCustomEst] = useState("");
  const [customAct, setCustomAct] = useState("");
  const [customLineCategory, setCustomLineCategory] = useState("Room & Nursing");
  const [customLineEst, setCustomLineEst] = useState("");
  const [customLineAct, setCustomLineAct] = useState("");
  const [customLineNote, setCustomLineNote] = useState("");
  const [customItems, setCustomItems] = useState([]);

  const activeBill = bills.find((b) => b.id === selectedBillId) || bills[0];

  const handleAddLineItem = () => {
    if (!customLineEst && !customLineAct) return;
    const est = parseFloat(customLineEst) || 0;
    const act = parseFloat(customLineAct) || 0;
    const diff = act - est;

    let flag = "ok";
    let flagText = "On budget";
    if (diff > 5000) {
      flag = "critical";
      flagText = `Exceeded estimate by ₹${diff.toLocaleString("en-IN")}`;
    } else if (diff > 0) {
      flag = "warn";
      flagText = `Exceeded estimate by ₹${diff.toLocaleString("en-IN")}`;
    }

    const newItem = {
      category: customLineCategory,
      estimated: est,
      actual: act,
      variance: diff,
      flag,
      flagText,
      explanation: customLineNote || "User entered line item.",
    };

    setCustomItems([...customItems, newItem]);
    setCustomLineEst("");
    setCustomLineAct("");
    setCustomLineNote("");
  };

  const handleSaveCustomBill = (e) => {
    e.preventDefault();
    if (!customProc || !customHosp) return;

    const estTot = parseFloat(customEst) || customItems.reduce((acc, i) => acc + i.estimated, 0);
    const actTot = parseFloat(customAct) || customItems.reduce((acc, i) => acc + i.actual, 0);
    const diff = actTot - estTot;
    const pct = estTot > 0 ? ((diff / estTot) * 100).toFixed(1) : 0;

    const newBill = {
      id: "custom_" + Date.now(),
      procedure: customProc,
      hospital: customHosp,
      city: "User Entry",
      patient: "Personal Bill Entry",
      date: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      estimatedTotal: estTot,
      actualTotal: actTot,
      variance: diff,
      variancePct: pct,
      lineItems: customItems.length > 0 ? customItems : [
        {
          category: "Consolidated Hospital Treatment",
          estimated: estTot,
          actual: actTot,
          variance: diff,
          flag: diff > 0 ? "warn" : "ok",
          explanation: "Single line comparison entered by patient.",
          flagText: diff > 0 ? "Discrepancy detected" : "Matches estimate",
        },
      ],
      negotiationTips: [
        "Request an itemized billing ledger from the medical records department with MRP details.",
        "Compare each line item against the pre-admission quotation given by the hospital TPA desk.",
        "Contest unlisted charges (administrative fees, medical records processing) that were not disclosed in writing.",
      ],
    };

    setBills([newBill, ...bills]);
    setSelectedBillId(newBill.id);
    setShowCustomModal(false);

    // Reset inputs
    setCustomProc("");
    setCustomHosp("");
    setCustomEst("");
    setCustomAct("");
    setCustomItems([]);
  };

  return (
    <div className="bill-comparator-hub">
      {/* ── Top Header & Presets ── */}
      <div className="bill-top-banner">
        <div>
          <div className="bill-kicker">
            <span className="b-pip" />
            <span>{t("cost.billKicker")}</span>
          </div>
          <h2 className="bill-title">{t("cost.billTitle")}</h2>
          <p className="bill-sub">{t("cost.billSub")}</p>
        </div>

        <button className="bill-create-btn" onClick={() => setShowCustomModal(true)}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>{t("cost.btnAuditOwn")}</span>
        </button>
      </div>

      {/* ── Preset Bill Selector ── */}
      <div className="bill-selector-tabs">
        <span className="b-sel-label">{t("cost.selectCase")}</span>
        <div className="b-sel-scroll">
          {bills.map((b) => (
            <button
              key={b.id}
              className={`b-tab-chip ${selectedBillId === b.id ? "active" : ""}`}
              onClick={() => setSelectedBillId(b.id)}
            >
              <span className="b-tab-name">{b.procedure}</span>
              <span className="b-tab-hosp">{b.hospital}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── High-Level Financial Impact Cards (Side-by-Side) ── */}
      <div className="bill-impact-grid">
        {/* Estimated Quote */}
        <div className="b-impact-card quote-card">
          <div className="b-impact-header">
            <span className="b-impact-icon">📋</span>
            <span className="b-impact-tag">{t("cost.impactQuote")}</span>
          </div>
          <div className="b-impact-num">₹{activeBill.estimatedTotal.toLocaleString("en-IN")}</div>
          <span className="b-impact-sub">{t("cost.impactQuoteSub")}</span>
        </div>

        {/* Actual Final Bill */}
        <div className="b-impact-card actual-card">
          <div className="b-impact-header">
            <span className="b-impact-icon">🧾</span>
            <span className="b-impact-tag">{t("cost.impactActual")}</span>
          </div>
          <div className="b-impact-num actual-val">₹{activeBill.actualTotal.toLocaleString("en-IN")}</div>
          <span className="b-impact-sub">{t("cost.impactActualSub")}</span>
        </div>

        {/* Overall Variance Discrepancy */}
        <div className={`b-impact-card variance-card ${activeBill.variance > 0 ? "has-variance" : "no-variance"}`}>
          <div className="b-impact-header">
            <span className="b-impact-icon">{activeBill.variance > 0 ? "⚠️" : "✅"}</span>
            <span className="b-impact-tag">{t("cost.impactVariance")}</span>
          </div>
          <div className="b-impact-num var-val">
            {activeBill.variance > 0 ? `+₹${activeBill.variance.toLocaleString("en-IN")}` : t("cost.impactVarianceZero")}
          </div>
          <span className="b-impact-sub">
            {activeBill.variance > 0
              ? t("cost.impactVarianceIncrease", { pct: activeBill.variancePct })
              : t("cost.impactVarianceOnBudget")}
          </span>
        </div>
      </div>

      {/* ── Line-by-Line Itemization & Explanation Table ── */}
      <div className="bill-ledger-card">
        <div className="ledger-header">
          <div>
            <h3 className="ledger-title">{t("cost.ledgerTitle")}</h3>
            <p className="ledger-subtitle">{t("cost.ledgerSub")}</p>
          </div>
          <div className="ledger-hospital-badge">
            <span>{activeBill.hospital}</span>
            <span className="l-date">{activeBill.date}</span>
          </div>
        </div>

        <div className="ledger-table-wrap">
          <div className="ledger-table-head">
            <span>{t("cost.colCategory")}</span>
            <span>{t("cost.colEstimate")}</span>
            <span>{t("cost.colActual")}</span>
            <span>{t("cost.colVariance")}</span>
            <span>{t("cost.colFinding")}</span>
          </div>

          <div className="ledger-rows">
            {activeBill.lineItems.map((item, idx) => {
              const isOver = item.variance > 0;
              return (
                <div key={idx} className={`ledger-row row-flag-${item.flag}`}>
                  <div className="col-cat">
                    <strong>{item.category}</strong>
                  </div>
                  <div className="col-est">
                    ₹{item.estimated.toLocaleString("en-IN")}
                  </div>
                  <div className="col-act">
                    <strong>₹{item.actual.toLocaleString("en-IN")}</strong>
                  </div>
                  <div className="col-var">
                    <span className={`var-pill ${item.flag}`}>
                      {isOver ? `+₹${item.variance.toLocaleString("en-IN")}` : "₹0"}
                    </span>
                  </div>
                  <div className="col-expl">
                    <span className={`expl-tag tag-${item.flag}`}>{item.flagText}</span>
                    <p className="expl-text">{item.explanation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Discrepancy Action & Dispute Protocol ── */}
      <div className="bill-dispute-section">
        <div className="dispute-box">
          <div className="dispute-head">
            <span className="dispute-icon">💡</span>
            <h4>{t("cost.disputeTitle")}</h4>
          </div>
          <p className="dispute-desc">
            {t("cost.disputeDesc")}
          </p>
          <ul className="dispute-list">
            {activeBill.negotiationTips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Modal to Audit Own Custom Bill ── */}
      {showCustomModal && (
        <div className="modal-backdrop" onClick={() => setShowCustomModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("cost.modalTitle")}</h3>
              <button className="modal-close-btn" onClick={() => setShowCustomModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveCustomBill} className="modal-form">
              <div className="form-row">
                <label>
                  <span>{t("cost.procName")}</span>
                  <input
                    type="text"
                    required
                    placeholder={t("cost.procPlaceholder")}
                    value={customProc}
                    onChange={(e) => setCustomProc(e.target.value)}
                  />
                </label>
                <label>
                  <span>{t("cost.hospitalName")}</span>
                  <input
                    type="text"
                    required
                    placeholder={t("cost.hospitalPlaceholder")}
                    value={customHosp}
                    onChange={(e) => setCustomHosp(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>{t("cost.estCost")}</span>
                  <input
                    type="number"
                    placeholder={t("cost.estCostPlaceholder")}
                    value={customEst}
                    onChange={(e) => setCustomEst(e.target.value)}
                  />
                </label>
                <label>
                  <span>{t("cost.actCost")}</span>
                  <input
                    type="number"
                    placeholder={t("cost.actCostPlaceholder")}
                    value={customAct}
                    onChange={(e) => setCustomAct(e.target.value)}
                  />
                </label>
              </div>

              {/* Add itemized lines */}
              <div className="modal-sub-section">
                <h4>{t("cost.addLineTitle")}</h4>
                <div className="line-input-grid">
                  <select
                    value={customLineCategory}
                    onChange={(e) => setCustomLineCategory(e.target.value)}
                  >
                    <option>Room Rent & Nursing</option>
                    <option>Doctor / Surgeon Fees</option>
                    <option>OT & Anesthesia</option>
                    <option>Diagnostics & Labs</option>
                    <option>Pharmacy & Consumables</option>
                    <option>Administrative / Hidden Surcharges</option>
                  </select>
                  <input
                    type="number"
                    placeholder={t("cost.lineEstPlaceholder")}
                    value={customLineEst}
                    onChange={(e) => setCustomLineEst(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder={t("cost.actEstPlaceholder")}
                    value={customLineAct}
                    onChange={(e) => setCustomLineAct(e.target.value)}
                  />
                  <button type="button" className="line-add-btn" onClick={handleAddLineItem}>
                    {t("cost.btnAddItem")}
                  </button>
                </div>
                {customLineAct && (
                  <input
                    type="text"
                    className="line-note-input"
                    placeholder={t("cost.lineWhyPlaceholder")}
                    value={customLineNote}
                    onChange={(e) => setCustomLineNote(e.target.value)}
                  />
                )}

                {/* Staged Line Items List */}
                {customItems.length > 0 && (
                  <div className="staged-items-list">
                    {customItems.map((item, idx) => (
                      <div key={idx} className="staged-item">
                        <span><strong>{item.category}</strong>: Est ₹{item.estimated} vs Act ₹{item.actual} (+₹{item.variance})</span>
                        <button
                          type="button"
                          className="staged-del"
                          onClick={() => setCustomItems(customItems.filter((_, i) => i !== idx))}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCustomModal(false)}>
                  {t("cost.btnCancel")}
                </button>
                <button type="submit" className="btn-save">
                  {t("cost.btnCalculate")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
