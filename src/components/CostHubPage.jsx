import { useState } from "react";
import BillComparator from "./BillComparator";
import HospitalPriceCompare from "./HospitalPriceCompare";
import { useLanguage } from "../context/LanguageContext";

export default function CostHubPage() {
  const [activeSubTab, setActiveSubTab] = useState("bills");
  const { t } = useLanguage();

  return (
    <div className="cost-hub-view">
      {/* ── Sub Navigation Header ── */}
      <div className="cost-subnav-dock">
        <button
          className={`cost-sub-btn ${activeSubTab === "bills" ? "active" : ""}`}
          onClick={() => setActiveSubTab("bills")}
        >
          <span className="cost-sub-icon">🧾</span>
          <div className="cost-sub-meta">
            <span className="cost-sub-title">{t("cost.tabBills")}</span>
            <span className="cost-sub-tag">{t("cost.tabBillsTag")}</span>
          </div>
        </button>

        <button
          className={`cost-sub-btn ${activeSubTab === "pricing" ? "active" : ""}`}
          onClick={() => setActiveSubTab("pricing")}
        >
          <span className="cost-sub-icon">🏥</span>
          <div className="cost-sub-meta">
            <span className="cost-sub-title">{t("cost.tabPricing")}</span>
            <span className="cost-sub-tag">{t("cost.tabPricingTag")}</span>
          </div>
        </button>
      </div>

      {/* ── Sub-Tab Content ── */}
      <div className="cost-tab-body">
        {activeSubTab === "bills" && <BillComparator />}
        {activeSubTab === "pricing" && <HospitalPriceCompare />}
      </div>
    </div>
  );
}
