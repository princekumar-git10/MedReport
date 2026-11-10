import { useState, useMemo } from "react";
import hospitalPackages from "../data/hospitalPackages.json";
import { useLanguage } from "../context/LanguageContext";

export default function HospitalPriceCompare() {
  const [selectedProcId, setSelectedProcId] = useState(hospitalPackages[0].id);
  const [selectedRoom, setSelectedRoom] = useState("Semi-Private");
  const [cityFilter, setCityFilter] = useState("All");
  const { t, tRoom } = useLanguage();

  const currentProcedure = hospitalPackages.find((p) => p.id === selectedProcId) || hospitalPackages[0];

  // Available room types from current procedure packages
  const availableRooms = useMemo(() => {
    const set = new Set();
    currentProcedure.packages.forEach((pkg) => {
      Object.keys(pkg.roomTypes).forEach((r) => set.add(r));
    });
    return Array.from(set);
  }, [currentProcedure]);

  const activeRoom = availableRooms.includes(selectedRoom) ? selectedRoom : availableRooms[0] || "Semi-Private";

  // Filter packages by city & sort by price ascending
  const sortedPackages = useMemo(() => {
    return currentProcedure.packages
      .filter((pkg) => {
        if (cityFilter === "All") return true;
        return pkg.city.toLowerCase().includes(cityFilter.toLowerCase());
      })
      .sort((a, b) => {
        const priceA = a.roomTypes[activeRoom] || a.roomTypes[Object.keys(a.roomTypes)[0]] || 0;
        const priceB = b.roomTypes[activeRoom] || b.roomTypes[Object.keys(b.roomTypes)[0]] || 0;
        return priceA - priceB;
      });
  }, [currentProcedure, cityFilter, activeRoom]);

  return (
    <div className="hosp-price-hub">
      {/* ── Top Kicker ── */}
      <div className="hosp-banner">
        <div>
          <div className="hosp-badge">
            <span className="h-pip" />
            <span>{t("cost.hospKicker")}</span>
          </div>
          <h2 className="hosp-title">{t("cost.hospTitle")}</h2>
          <p className="hosp-sub">{t("cost.hospSub")}</p>
        </div>
      </div>

      {/* ── Procedure Selection Carousel ── */}
      <div className="proc-selector-row">
        <span className="proc-label">{t("cost.selectProc")}</span>
        <div className="proc-chips-scroll">
          {hospitalPackages.map((proc) => (
            <button
              key={proc.id}
              className={`proc-chip ${selectedProcId === proc.id ? "active" : ""}`}
              onClick={() => setSelectedProcId(proc.id)}
            >
              <span className="p-cat">{proc.category}</span>
              <strong className="p-name">{proc.procedure}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter Bar: Room Category & City ── */}
      <div className="hosp-filters-bar">
        <div className="filter-group">
          <span className="filter-label">{t("cost.roomCategory")}</span>
          <div className="room-pills">
            {availableRooms.map((room) => (
              <button
                key={room}
                className={`room-pill ${activeRoom === room ? "active" : ""}`}
                onClick={() => setSelectedRoom(room)}
              >
                {tRoom(room)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">{t("cost.cityFilter")}</span>
          <select
            className="city-select"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="All">{t("cost.allCities")}</option>
            <option value="Delhi">Delhi NCR</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Chennai">Chennai</option>
            <option value="Kolkata">Kolkata</option>
          </select>
        </div>
      </div>

      {/* ── Procedure Overview Banner ── */}
      <div className="proc-info-bar">
        <div className="p-info-main">
          <h3>{currentProcedure.procedure}</h3>
          <p>{currentProcedure.description}</p>
        </div>
        <div className="p-stay-pill">
          <span>{t("cost.stayLabel")}</span>
          <strong>
            {currentProcedure.stayDays === 0
              ? t("cost.daycare")
              : t("cost.stayDays", { days: currentProcedure.stayDays })}
          </strong>
        </div>
      </div>

      {/* ── Hospital Comparison Cards Grid ── */}
      <div className="hosp-cards-grid">
        {sortedPackages.map((pkg, idx) => {
          const packagePrice = pkg.roomTypes[activeRoom] || pkg.roomTypes[Object.keys(pkg.roomTypes)[0]] || 0;
          const isLowest = idx === 0 && sortedPackages.length > 1;

          return (
            <div key={pkg.hospital} className={`hosp-pkg-card ${isLowest ? "lowest-price" : ""}`}>
              {isLowest && (
                <div className="lowest-price-badge">
                  <span>{t("cost.lowestBadge")}</span>
                </div>
              )}

              <div className="hosp-card-header">
                <div>
                  <h4 className="hosp-name">{pkg.hospital}</h4>
                  <div className="hosp-location-row">
                    <span className="hosp-city">{pkg.city}</span>
                    <span className="hosp-rating">⭐ {pkg.rating}</span>
                    <span className="hosp-accred">{pkg.accreditation}</span>
                  </div>
                </div>

                <div className="hosp-price-box">
                  <span className="price-tag-label">{t("cost.roomPkg", { room: tRoom(activeRoom) })}</span>
                  <div className="price-amount">₹{packagePrice.toLocaleString("en-IN")}</div>
                  <span className="price-inclusive">{t("cost.docFeeInc")}</span>
                </div>
              </div>

              {/* Room Tariff Options */}
              <div className="hosp-room-tiers">
                <span className="tiers-label">{t("cost.roomTariffs")}</span>
                <div className="tiers-chips">
                  {Object.entries(pkg.roomTypes).map(([rName, rPrice]) => (
                    <span key={rName} className={`tier-chip ${rName === activeRoom ? "selected" : ""}`}>
                      {tRoom(rName)}: <strong>₹{rPrice.toLocaleString("en-IN")}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Inclusions & Investigations */}
              <div className="hosp-details-grid">
                <div className="detail-col">
                  <span className="detail-col-title">{t("cost.inclusions")}</span>
                  <ul className="check-list">
                    {pkg.inclusions.map((inc, i) => (
                      <li key={i}>{inc}</li>
                    ))}
                  </ul>

                  <span className="detail-col-title" style={{ marginTop: "10px" }}>{t("cost.diagnosticLabs")}</span>
                  <div className="lab-tags-wrap">
                    {pkg.investigationsIncluded.map((lab, i) => (
                      <span key={i} className="lab-tag">{lab}</span>
                    ))}
                  </div>
                </div>

                {/* Exclusions & Hidden Charges */}
                <div className="detail-col exclusions-col">
                  <span className="detail-col-title warn-title">{t("cost.exclusions")}</span>
                  <ul className="cross-list">
                    {pkg.exclusions.map((exc, i) => (
                      <li key={i}>{exc}</li>
                    ))}
                  </ul>
                  <div className="doc-fee-note">
                    <span>{t("cost.surgeonFee")}</span>
                    <strong>₹{pkg.doctorFee.toLocaleString("en-IN")} {t("cost.includedInBase")}</strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
