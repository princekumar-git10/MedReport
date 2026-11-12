import { useState, useEffect } from "react";
import { 
  getHospitals, 
  registerHospital, 
  updateHospitalCapacity, 
  updateResourceStatus,
  claimHospitalStaff,
  subscribeToHospitals
} from "../services/hospitalService.js";
import {
  getIncomingReferralsForHospital,
  executeHospitalReferralAction,
  releaseOrExpireCapacityHold,
  sweepExpiredCapacityHolds,
  updateReferralJourneyStep,
  subscribeToReferrals,
  VALID_REJECTION_REASONS
} from "../services/referralService.js";
import { useLanguage } from "../context/LanguageContext";

export default function HospitalManagement({ userEmail, onNavigateToDoctor }) {
  const { t } = useLanguage();

  // Active section inside the hospital module: "directory" | "dashboard" | "incoming" | "register"
  const [activeTab, setActiveTab] = useState("directory");

  // State
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCity, setFilterCity] = useState("all");
  const [filterAvailability, setFilterAvailability] = useState("all"); // "all" | "available" | "icu" | "confirmed"

  // Incoming Referrals State
  const [incomingReferrals, setIncomingReferrals] = useState([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [referralFilterUrgency, setReferralFilterUrgency] = useState("all"); // "all" | "Emergency" | "Urgent" | "Routine"
  const [referralFilterStatus, setReferralFilterStatus] = useState("all"); // "all" | "Pending" | "Accepted" | "Rejected" | "Information Requested"

  // Referral Action Modal States
  const [activeModal, setActiveModal] = useState(null); // null | "accept" | "reject" | "request_info" | "view_docs"
  const [targetReferral, setTargetReferral] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [activeDocToView, setActiveDocToView] = useState(null);

  // Form states for referral action modals
  const [acceptForm, setAcceptForm] = useState({
    staffName: "Staff Admin",
    staffEmail: userEmail || "staff@hospital.med",
    authorizeCapacityHold: true,
    clinicalNotes: "",
  });

  const [rejectForm, setRejectForm] = useState({
    staffName: "Staff Admin",
    staffEmail: userEmail || "staff@hospital.med",
    rejectionReason: VALID_REJECTION_REASONS[0],
    clinicalNotes: "",
  });

  const [infoForm, setInfoForm] = useState({
    staffName: "Staff Admin",
    staffEmail: userEmail || "staff@hospital.med",
    requestedInfo: "",
    message: "",
  });

  // Capacity update form state
  const [capacityForm, setCapacityForm] = useState({
    availableBeds: 0,
    occupiedBeds: 0,
    availableIcuBeds: 0,
    availableEmergencyBeds: 0,
    activeReferrals: 0,
    acceptedReferrals: 0,
    rejectedReferrals: 0,
    staffName: "",
    staffEmail: userEmail || "staff@hospital.med",
  });
  const [capacityError, setCapacityError] = useState("");
  const [capacitySuccess, setCapacitySuccess] = useState("");
  const [updatingCapacity, setUpdatingCapacity] = useState(false);

  // Registration form state
  const [regForm, setRegForm] = useState({
    name: "",
    regNumber: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    latitude: "",
    longitude: "",
    contactPhone: "",
    email: userEmail || "",
    hospitalType: "Super Specialty & Advanced Laser Center",
    departments: "Laser Surgery, Laser Proctology, Laparoscopic Surgery, Urology, Emergency Medicine",
    availableTreatments: "Laser Hemorrhoidoplasty, Laser Varicose Veins (EVLA), Laser Kidney Stone (HoLEP), Laparoscopic Hernia Repair",
    medicalEquipment: "1470nm Dual Diode Laser, 100W Holmium:YAG Laser, 4K Laparoscopy Tower, C-Arm Fluoroscopy",
    emergencyAvailable: true,
    emergencyDetails: "24/7 Acute Surgical Emergency Receiving & Resuscitation",
    emergencyBedCapacity: 10,
    icuAvailable: true,
    icuDetails: "Surgical and Post-Op Critical Care ICU with Ventilators",
    icuBedCapacity: 12,
    generalBedCapacity: 60,
    occupiedBeds: 35,
    creatorName: "Hospital Registrar",
  });
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [registering, setRegistering] = useState(false);

  // Load hospitals
  const loadHospitalsData = async () => {
    setLoading(true);
    try {
      const list = await getHospitals();
      setHospitals(list);
      if (list.length > 0 && !selectedHospitalId) {
        setSelectedHospitalId(list[0].id);
      }
    } catch (e) {
      console.error("Failed to load hospitals:", e);
    }
    setLoading(false);
  };

  // Load incoming referrals for selected hospital
  const loadIncomingReferralsData = async (hospId) => {
    if (!hospId) return;
    setLoadingReferrals(true);
    try {
      const data = await getIncomingReferralsForHospital(hospId);
      setIncomingReferrals(data);
    } catch (e) {
      console.error("Failed to load incoming referrals:", e);
    }
    setLoadingReferrals(false);
  };

  useEffect(() => {
    sweepExpiredCapacityHolds().catch(() => {});
    loadHospitalsData();

    const unsubHosp = subscribeToHospitals((updatedHospitals) => {
      if (Array.isArray(updatedHospitals)) {
        setHospitals(updatedHospitals);
      }
    });

    const unsubRef = subscribeToReferrals(() => {
      if (selectedHospitalId) {
        loadIncomingReferralsData(selectedHospitalId);
      }
    });

    return () => {
      unsubHosp();
      unsubRef();
    };
  }, [selectedHospitalId]);

  const handleReleaseHold = async (referral) => {
    try {
      await releaseOrExpireCapacityHold(referral.id, "Cancelled by hospital admissions", {
        name: acceptForm.staffName || "Hospital Staff",
        email: acceptForm.staffEmail || userEmail || "staff@hospital.med",
      });
      await loadHospitalsData();
      if (selectedHospitalId) await loadIncomingReferralsData(selectedHospitalId);
    } catch (err) {
      alert(err.message || "Failed to release capacity hold.");
    }
  };

  const handleAdvanceJourney = async (referral, nextStep) => {
    try {
      await updateReferralJourneyStep(referral.id, nextStep, {
        name: acceptForm.staffName || selectedHospital?.name || "Hospital Admissions",
      });
      await loadHospitalsData();
      if (selectedHospitalId) await loadIncomingReferralsData(selectedHospitalId);
    } catch (err) {
      alert(err.message || "Failed to update patient milestone.");
    }
  };

  // Currently selected hospital in dashboard
  const selectedHospital = hospitals.find((h) => h.id === selectedHospitalId) || hospitals[0] || null;

  // Sync capacity form and load referrals when selected hospital changes
  useEffect(() => {
    if (selectedHospital) {
      setCapacityForm({
        availableBeds: selectedHospital.availableBeds,
        occupiedBeds: selectedHospital.occupiedBeds,
        availableIcuBeds: selectedHospital.icuFacilities?.availableBeds ?? selectedHospital.icuBedCapacity,
        availableEmergencyBeds: selectedHospital.availableEmergencyBeds,
        activeReferrals: selectedHospital.activeReferrals || 0,
        acceptedReferrals: selectedHospital.acceptedReferrals || 0,
        rejectedReferrals: selectedHospital.rejectedReferrals || 0,
        staffName: selectedHospital.lastUpdatedBy || "Dr. Staff",
        staffEmail: userEmail || selectedHospital.lastUpdatedByEmail || "staff@hospital.med",
      });
      setCapacityError("");
      setCapacitySuccess("");

      // Prefill modal staff credentials
      setAcceptForm((prev) => ({
        ...prev,
        staffName: selectedHospital.lastUpdatedBy || prev.staffName,
        staffEmail: userEmail || selectedHospital.lastUpdatedByEmail || prev.staffEmail,
      }));
      setRejectForm((prev) => ({
        ...prev,
        staffName: selectedHospital.lastUpdatedBy || prev.staffName,
        staffEmail: userEmail || selectedHospital.lastUpdatedByEmail || prev.staffEmail,
      }));
      setInfoForm((prev) => ({
        ...prev,
        staffName: selectedHospital.lastUpdatedBy || prev.staffName,
        staffEmail: userEmail || selectedHospital.lastUpdatedByEmail || prev.staffEmail,
      }));

      loadIncomingReferralsData(selectedHospital.id);
    }
  }, [selectedHospitalId, hospitals, userEmail]);

  // Handle Capacity Update Submission
  const handleCapacitySubmit = async (e) => {
    e.preventDefault();
    setCapacityError("");
    setCapacitySuccess("");

    if (!selectedHospital) return;

    // Check capacity ceiling
    const avail = parseInt(capacityForm.availableBeds, 10);
    const occ = parseInt(capacityForm.occupiedBeds, 10);
    const total = selectedHospital.generalBedCapacity;

    if (avail < 0 || occ < 0) {
      setCapacityError("Bed counts cannot be negative numbers.");
      return;
    }

    if (avail > total) {
      setCapacityError(`Available beds (${avail}) cannot exceed configured capacity (${total}).`);
      return;
    }

    if (avail + occ > total) {
      setCapacityError(`Total of Available (${avail}) + Occupied (${occ}) exceeds total general capacity (${total}). Please adjust numbers.`);
      return;
    }

    const icuAvail = parseInt(capacityForm.availableIcuBeds, 10);
    if (icuAvail > selectedHospital.icuBedCapacity) {
      setCapacityError(`Available ICU beds (${icuAvail}) cannot exceed configured ICU capacity (${selectedHospital.icuBedCapacity}).`);
      return;
    }

    const emergAvail = parseInt(capacityForm.availableEmergencyBeds, 10);
    const emergTotal = selectedHospital.emergencyFacilities?.bedCapacity || 15;
    if (emergAvail > emergTotal) {
      setCapacityError(`Available emergency beds (${emergAvail}) cannot exceed emergency capacity (${emergTotal}).`);
      return;
    }

    setUpdatingCapacity(true);
    try {
      const updated = await updateHospitalCapacity(
        selectedHospital.id,
        {
          availableBeds: avail,
          occupiedBeds: occ,
          availableIcuBeds: icuAvail,
          availableEmergencyBeds: emergAvail,
          activeReferrals: parseInt(capacityForm.activeReferrals, 10),
          acceptedReferrals: parseInt(capacityForm.acceptedReferrals, 10),
          rejectedReferrals: parseInt(capacityForm.rejectedReferrals, 10),
        },
        {
          name: capacityForm.staffName.trim() || "Hospital Staff",
          email: capacityForm.staffEmail.trim() || userEmail || "staff@hospital.med",
        }
      );

      setCapacitySuccess(`Capacity successfully updated and confirmed by ${updated.lastUpdatedBy}!`);
      // Reload list
      const fresh = await getHospitals();
      setHospitals(fresh);
    } catch (err) {
      setCapacityError(err.message || "Failed to update capacity.");
    }
    setUpdatingCapacity(false);
  };

  // Handle Resource Status Change
  const handleResourceStatusChange = async (resourceKey, newStatus) => {
    if (!selectedHospital) return;
    try {
      await updateResourceStatus(
        selectedHospital.id,
        resourceKey,
        newStatus,
        {
          name: capacityForm.staffName || "Staff Admin",
          email: capacityForm.staffEmail || userEmail || "staff@hospital.med",
        }
      );
      const fresh = await getHospitals();
      setHospitals(fresh);
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Hospital Registration Submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    if (!regForm.name.trim()) {
      setRegError("Hospital name is required.");
      return;
    }
    if (!regForm.city.trim() || !regForm.state.trim()) {
      setRegError("City and State are required.");
      return;
    }
    if (parseInt(regForm.generalBedCapacity, 10) <= 0) {
      setRegError("General bed capacity must be at least 1.");
      return;
    }

    setRegistering(true);
    try {
      const newHosp = await registerHospital(regForm, userEmail || regForm.email || "staff@hospital.med");
      setRegSuccess(`Hospital registered successfully with Unique ID: ${newHosp.id}`);
      const fresh = await getHospitals();
      setHospitals(fresh);
      setSelectedHospitalId(newHosp.id);
      setTimeout(() => {
        setActiveTab("dashboard");
      }, 1200);
    } catch (err) {
      setRegError(err.message || "Registration failed.");
    }
    setRegistering(false);
  };

  // ── INCOMING REFERRAL ACTIONS ──

  // Open Accept Modal
  const openAcceptModal = (referral) => {
    setTargetReferral(referral);
    setActionError("");
    setActionSuccess("");
    setAcceptForm({
      staffName: selectedHospital?.lastUpdatedBy || "Dr. Arvind Mehta",
      staffEmail: userEmail || selectedHospital?.lastUpdatedByEmail || "admin@hospital.med",
      authorizeCapacityHold: true,
      clinicalNotes: "",
    });
    setActiveModal("accept");
  };

  // Submit Accept Action
  const handleConfirmAccept = async (e) => {
    e.preventDefault();
    if (!targetReferral || !selectedHospital) return;

    setActionError("");
    setActionSuccess("");
    setActionSubmitting(true);

    try {
      const res = await executeHospitalReferralAction({
        action: "accept",
        referralId: targetReferral.id,
        hospitalId: selectedHospital.id,
        staffName: acceptForm.staffName.trim() || "Authorized Staff",
        staffEmail: acceptForm.staffEmail.trim() || userEmail || "staff@hospital.med",
        authorizeCapacityHold: acceptForm.authorizeCapacityHold,
        clinicalNotes: acceptForm.clinicalNotes.trim(),
      });

      setActionSuccess(`Referral ${targetReferral.id} successfully accepted! Bed reservation prioritized.`);
      
      // Refresh local view
      await loadIncomingReferralsData(selectedHospital.id);
      const freshHosps = await getHospitals();
      setHospitals(freshHosps);

      setTimeout(() => {
        setActiveModal(null);
        setTargetReferral(null);
      }, 1500);
    } catch (err) {
      setActionError(err.message || "Failed to accept referral.");
    }
    setActionSubmitting(false);
  };

  // Open Reject Modal
  const openRejectModal = (referral) => {
    setTargetReferral(referral);
    setActionError("");
    setActionSuccess("");
    setRejectForm({
      staffName: selectedHospital?.lastUpdatedBy || "Dr. Staff",
      staffEmail: userEmail || selectedHospital?.lastUpdatedByEmail || "staff@hospital.med",
      rejectionReason: VALID_REJECTION_REASONS[0],
      clinicalNotes: "",
    });
    setActiveModal("reject");
  };

  // Submit Reject Action
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!targetReferral || !selectedHospital) return;

    if (!rejectForm.rejectionReason) {
      setActionError("Please select a mandatory clinical rejection reason.");
      return;
    }

    setActionError("");
    setActionSuccess("");
    setActionSubmitting(true);

    try {
      await executeHospitalReferralAction({
        action: "reject",
        referralId: targetReferral.id,
        hospitalId: selectedHospital.id,
        staffName: rejectForm.staffName.trim() || "Authorized Staff",
        staffEmail: rejectForm.staffEmail.trim() || userEmail || "staff@hospital.med",
        rejectionReason: rejectForm.rejectionReason,
        clinicalNotes: rejectForm.clinicalNotes.trim(),
      });

      setActionSuccess(`Referral ${targetReferral.id} declined. Referring clinician has been notified.`);
      
      await loadIncomingReferralsData(selectedHospital.id);
      const freshHosps = await getHospitals();
      setHospitals(freshHosps);

      setTimeout(() => {
        setActiveModal(null);
        setTargetReferral(null);
      }, 1500);
    } catch (err) {
      setActionError(err.message || "Failed to reject referral.");
    }
    setActionSubmitting(false);
  };

  // Open Request More Info Modal
  const openInfoModal = (referral) => {
    setTargetReferral(referral);
    setActionError("");
    setActionSuccess("");
    setInfoForm({
      staffName: selectedHospital?.lastUpdatedBy || "Dr. Staff",
      staffEmail: userEmail || selectedHospital?.lastUpdatedByEmail || "staff@hospital.med",
      requestedInfo: "Latest diagnostic lab report / Coagulation panel",
      message: "",
    });
    setActiveModal("request_info");
  };

  // Submit Request Info Action
  const handleConfirmRequestInfo = async (e) => {
    e.preventDefault();
    if (!targetReferral || !selectedHospital) return;

    if (!infoForm.requestedInfo.trim() && !infoForm.message.trim()) {
      setActionError("Please describe the specific document or clinical details required.");
      return;
    }

    setActionError("");
    setActionSuccess("");
    setActionSubmitting(true);

    try {
      await executeHospitalReferralAction({
        action: "request_info",
        referralId: targetReferral.id,
        hospitalId: selectedHospital.id,
        staffName: infoForm.staffName.trim() || "Authorized Staff",
        staffEmail: infoForm.staffEmail.trim() || userEmail || "staff@hospital.med",
        requestedInfo: infoForm.requestedInfo.trim(),
        message: infoForm.message.trim(),
      });

      setActionSuccess(`Clarification request transmitted to referring clinician for ${targetReferral.id}.`);
      
      await loadIncomingReferralsData(selectedHospital.id);

      setTimeout(() => {
        setActiveModal(null);
        setTargetReferral(null);
      }, 1500);
    } catch (err) {
      setActionError(err.message || "Failed to submit information request.");
    }
    setActionSubmitting(false);
  };

  // Open Document Viewer Modal
  const openDocViewer = (doc, referral) => {
    setActiveDocToView(doc);
    setTargetReferral(referral);
    setActiveModal("view_docs");
  };

  // Incoming referrals calculations
  const pendingIncomingCount = incomingReferrals.filter(
    (r) => r.status === "Pending" || r.status === "Created" || r.status === "Information Requested"
  ).length;

  const filteredIncomingReferrals = incomingReferrals.filter((r) => {
    if (referralFilterUrgency !== "all" && r.priority !== referralFilterUrgency) {
      return false;
    }
    if (referralFilterStatus !== "all" && r.status !== referralFilterStatus) {
      return false;
    }
    return true;
  });

  // Filtered hospitals for Directory
  const cities = ["all", ...new Set(hospitals.map((h) => h.city).filter(Boolean))];

  const filteredHospitals = hospitals.filter((h) => {
    // Search query matches name, city, departments, treatments, or ID
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.city.toLowerCase().includes(q) ||
      h.id.toLowerCase().includes(q) ||
      (h.departments && h.departments.some((d) => d.toLowerCase().includes(q))) ||
      (h.availableTreatments && h.availableTreatments.some((t) => t.toLowerCase().includes(q))) ||
      (h.medicalEquipment && h.medicalEquipment.some((e) => e.toLowerCase().includes(q)));

    if (!matchesSearch) return false;

    // Filter city
    if (filterCity !== "all" && h.city !== filterCity) return false;

    // Filter availability
    if (filterAvailability === "available" && h.availableBeds <= 0) return false;
    if (filterAvailability === "icu" && (h.icuFacilities?.availableBeds || 0) <= 0) return false;
    if (filterAvailability === "confirmed" && !h.confirmedByHospital) return false;

    return true;
  });

  // Relative time helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "Recently";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins} mins ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} hrs ago`;
      const days = Math.floor(hrs / 24);
      return `${days} days ago`;
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="hospital-module-wrap">
      {/* ── Sub-Navigation Bar for Hospitals Module ── */}
      <div className="hosp-nav-header">
        <div className="hosp-nav-title-group">
          <div className="hosp-pill-badge">
            <span className="live-pulse-dot" />
            <span>Relief Laser Health · Infrastructure</span>
          </div>
          <h2 className="hosp-main-title">Hospital Network &amp; Management</h2>
          <p className="hosp-main-sub">
            Real-time bed availability telemetry, specialty treatment routing, and hospital staff resource controls.
          </p>
        </div>

        <div className="hosp-tab-switch">
          <button
            type="button"
            className={`hosp-tab-btn ${activeTab === "directory" ? "active" : ""}`}
            onClick={() => setActiveTab("directory")}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span>Hospital Directory</span>
            <span className="tab-counter">{hospitals.length}</span>
          </button>

          <button
            type="button"
            className={`hosp-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            <span>Management Dashboard</span>
          </button>

          <button
            type="button"
            className={`hosp-tab-btn ${activeTab === "incoming" ? "active" : ""}`}
            onClick={() => setActiveTab("incoming")}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <span>Incoming Referrals</span>
            {pendingIncomingCount > 0 && (
              <span className="tab-counter alert">{pendingIncomingCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`hosp-tab-btn ${activeTab === "register" ? "active" : ""}`}
            onClick={() => setActiveTab("register")}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Register Hospital</span>
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION A: HOSPITAL DIRECTORY
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "directory" && (
        <section className="hosp-directory-section">
          {/* Search and Filters Bar */}
          <div className="hosp-filter-toolbar">
            <div className="hosp-search-box">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" className="search-icon">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search by hospital name, city, laser procedure (e.g. EVLA, HoLEP), or equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hosp-search-input"
              />
              {searchQuery && (
                <button type="button" className="clear-btn" onClick={() => setSearchQuery("")}>
                  ✕
                </button>
              )}
            </div>

            <div className="hosp-filter-group">
              <label htmlFor="city-filter" className="filter-label">City:</label>
              <select
                id="city-filter"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="hosp-select-filter"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All Cities" : c}
                  </option>
                ))}
              </select>

              <label htmlFor="status-filter" className="filter-label">Filter:</label>
              <select
                id="status-filter"
                value={filterAvailability}
                onChange={(e) => setFilterAvailability(e.target.value)}
                className="hosp-select-filter"
              >
                <option value="all">All Facilities</option>
                <option value="available">Beds Available Only</option>
                <option value="icu">ICU Available Only</option>
                <option value="confirmed">Hospital Confirmed Only</option>
              </select>
            </div>
          </div>

          {/* Result Count and Quick Notice */}
          <div className="hosp-results-banner">
            <span>Showing <strong>{filteredHospitals.length}</strong> verified network hospitals</span>
            <span className="telemetry-info-tag">Telemetry synchronized with hospital desks</span>
          </div>

          {/* Hospital Cards Grid */}
          {loading ? (
            <div className="hosp-loading-state">
              <div className="hosp-spinner" />
              <p>Loading verified hospital capacity telemetry...</p>
            </div>
          ) : filteredHospitals.length === 0 ? (
            <div className="hosp-empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No matching hospitals found</h3>
              <p>Try modifying your search query or city filter, or register a new facility.</p>
              <button
                type="button"
                className="relief-primary-btn compact"
                onClick={() => {
                  setSearchQuery("");
                  setFilterCity("all");
                  setFilterAvailability("all");
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="hosp-card-grid">
              {filteredHospitals.map((hosp) => {
                const occupancyRate = Math.round(
                  ((hosp.generalBedCapacity - hosp.availableBeds) / hosp.generalBedCapacity) * 100
                );
                const isConfirmed = hosp.confirmedByHospital;

                return (
                  <div key={hosp.id} className="hosp-dir-card">
                    {/* Top status bar */}
                    <div className="card-top-bar">
                      <div className="top-id-tag">
                        <span className="hosp-id-label">{hosp.id}</span>
                        {hosp.isDemoData && (
                          <span className="demo-data-badge" title="Development demonstration data">
                            Demo Data
                          </span>
                        )}
                      </div>

                      {/* Hospital Confirmed vs Reported */}
                      {isConfirmed ? (
                        <div className="confirmed-badge" title={`Confirmed by staff: ${hosp.lastUpdatedBy}`}>
                          <span className="dot-green" />
                          <span>Hospital Confirmed</span>
                        </div>
                      ) : (
                        <div className="reported-badge" title="Awaiting hospital staff live confirmation">
                          <span className="dot-amber" />
                          <span>Reported · Verification Pending</span>
                        </div>
                      )}
                    </div>

                    {/* Hospital Name & Registration */}
                    <div className="card-header-body">
                      <h3 className="hosp-name">{hosp.name}</h3>
                      <div className="hosp-meta-row">
                        <span className="hosp-type-badge">{hosp.hospitalType}</span>
                        <span className="hosp-reg-tag">Reg: {hosp.regNumber}</span>
                      </div>
                      <p className="hosp-address">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span>{hosp.address ? `${hosp.address}, ` : ""}{hosp.city}, {hosp.state} {hosp.pincode}</span>
                      </p>
                    </div>

                    {/* Bed Capacity Telemetry Section */}
                    <div className="card-capacity-telemetry">
                      <div className="telemetry-item">
                        <span className="cap-label">General Beds</span>
                        <div className="cap-numbers">
                          <strong className={`cap-avail ${hosp.availableBeds > 0 ? "good" : "zero"}`}>
                            {hosp.availableBeds}
                          </strong>
                          <span className="cap-total">/ {hosp.generalBedCapacity} open</span>
                        </div>
                        <div className="cap-progress-bar">
                          <div 
                            className={`cap-fill ${occupancyRate > 85 ? "high" : occupancyRate > 60 ? "med" : "low"}`}
                            style={{ width: `${Math.min(100, occupancyRate)}%` }}
                          />
                        </div>
                        <span className="occupancy-pct">{occupancyRate}% Occupied</span>
                      </div>

                      <div className="telemetry-item icu">
                        <span className="cap-label">ICU Capacity</span>
                        <div className="cap-numbers">
                          <strong className="cap-avail good">
                            {hosp.icuFacilities?.availableBeds ?? hosp.icuBedCapacity}
                          </strong>
                          <span className="cap-total">/ {hosp.icuBedCapacity} free</span>
                        </div>
                        <span className="icu-tag">
                          {hosp.icuFacilities?.available ? "Ventilator Supported" : "Basic ICU"}
                        </span>
                      </div>

                      <div className="telemetry-item emergency">
                        <span className="cap-label">Emergency Beds</span>
                        <div className="cap-numbers">
                          <strong className="cap-avail good">{hosp.availableEmergencyBeds}</strong>
                          <span className="cap-total">/ {hosp.emergencyFacilities?.bedCapacity || 10}</span>
                        </div>
                        <span className="emer-tag">24/7 Desk Open</span>
                      </div>
                    </div>

                    {/* Departments & Laser Treatments */}
                    <div className="card-departments">
                      <span className="section-micro-label">Departments &amp; Specialties:</span>
                      <div className="tag-cloud">
                        {hosp.departments?.slice(0, 4).map((dept, i) => (
                          <span key={i} className="chip-tag dept">{dept}</span>
                        ))}
                        {hosp.departments?.length > 4 && (
                          <span className="chip-tag more">+{hosp.departments.length - 4} more</span>
                        )}
                      </div>
                    </div>

                    <div className="card-treatments">
                      <span className="section-micro-label">Laser Treatments &amp; Procedures:</span>
                      <div className="tag-cloud">
                        {hosp.availableTreatments?.slice(0, 3).map((treat, i) => (
                          <span key={i} className="chip-tag laser">{treat}</span>
                        ))}
                        {hosp.availableTreatments?.length > 3 && (
                          <span className="chip-tag more">+{hosp.availableTreatments.length - 3} more</span>
                        )}
                      </div>
                    </div>

                    {/* Laser Equipment */}
                    {hosp.medicalEquipment && hosp.medicalEquipment.length > 0 && (
                      <div className="card-equipment">
                        <span className="section-micro-label">Laser &amp; Surgical Equipment:</span>
                        <p className="equip-text">{hosp.medicalEquipment.slice(0, 3).join(" • ")}</p>
                      </div>
                    )}

                    {/* Footer / Telemetry timestamp & actions */}
                    <div className="card-footer">
                      <div className="last-sync-time">
                        <span className="clock-icon">🕒</span>
                        <span>
                          Updated {formatTimeAgo(hosp.lastUpdatedAt)} by {hosp.lastUpdatedBy || "Staff"}
                        </span>
                      </div>

                      <div className="card-action-btns">
                        <button
                          type="button"
                          className="hosp-btn-secondary"
                          onClick={() => {
                            setSelectedHospitalId(hosp.id);
                            setActiveTab("dashboard");
                          }}
                        >
                          Staff Dashboard
                        </button>

                        <button
                          type="button"
                          className="hosp-btn-primary"
                          onClick={() => {
                            if (onNavigateToDoctor) {
                              onNavigateToDoctor(hosp);
                            } else {
                              alert(`Referral pass requested for ${hosp.name}.`);
                            }
                          }}
                        >
                          Refer Patient →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION B: HOSPITAL MANAGEMENT DASHBOARD
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "dashboard" && selectedHospital && (
        <section className="hosp-dashboard-section">
          {/* Facility Selector & Auth Banner */}
          <div className="dash-facility-picker-bar">
            <div className="picker-left">
              <label htmlFor="dash-hospital-select" className="picker-label">Active Hospital Facility:</label>
              <select
                id="dash-hospital-select"
                value={selectedHospital.id}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                className="picker-select"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city}) — ID: {h.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="picker-right">
              <div className="auth-staff-chip">
                <span className="staff-icon">👤</span>
                <span className="staff-email">
                  {userEmail || selectedHospital.lastUpdatedByEmail || "Authorized Staff Session"}
                </span>
                <span className="staff-status-badge">Staff Verified</span>
              </div>
            </div>
          </div>

          {/* Hospital Header Summary */}
          <div className="dash-hospital-header">
            <div>
              <div className="dash-id-strip">
                <span className="mono-id">{selectedHospital.id}</span>
                <span className="hosp-tag-type">{selectedHospital.hospitalType}</span>
                {selectedHospital.isDemoData && (
                  <span className="demo-data-badge">Demonstration Data (Sample Network Demo)</span>
                )}
                {selectedHospital.confirmedByHospital ? (
                  <span className="confirmed-pill">● Hospital Confirmed</span>
                ) : (
                  <span className="reported-pill">● Reported / Verification Pending</span>
                )}
              </div>
              <h1 className="dash-hospital-name">{selectedHospital.name}</h1>
              <p className="dash-hospital-address">
                {selectedHospital.address}, {selectedHospital.city}, {selectedHospital.state} {selectedHospital.pincode} • Phone: {selectedHospital.contactPhone} • Email: {selectedHospital.email}
              </p>
            </div>

            <div className="dash-last-updated-box">
              <span className="lub-title">Last Availability Update:</span>
              <strong className="lub-time">{new Date(selectedHospital.lastUpdatedAt).toLocaleString()}</strong>
              <span className="lub-by">Staff: {selectedHospital.lastUpdatedBy}</span>
            </div>
          </div>

          {/* ── THE 8 CORE DASHBOARD METRICS ── */}
          <div className="dash-metrics-grid">
            {/* 1. Total Beds */}
            <div className="metric-box box-navy">
              <span className="metric-num-label">1. Total Beds</span>
              <div className="metric-val-row">
                <strong className="metric-primary-val">{selectedHospital.generalBedCapacity}</strong>
                <span className="metric-unit">Configured</span>
              </div>
              <span className="metric-foot">Official Registered Capacity</span>
            </div>

            {/* 2. Occupied Beds */}
            <div className="metric-box box-amber">
              <span className="metric-num-label">2. Occupied Beds</span>
              <div className="metric-val-row">
                <strong className="metric-primary-val">{selectedHospital.occupiedBeds}</strong>
                <span className="metric-unit">Inpatients</span>
              </div>
              <span className="metric-foot">
                {Math.round((selectedHospital.occupiedBeds / selectedHospital.generalBedCapacity) * 100)}% Occupancy Rate
              </span>
            </div>

            {/* 3. Available Beds */}
            <div className="metric-box box-green">
              <span className="metric-num-label">3. Available Beds</span>
              <div className="metric-val-row">
                <strong className="metric-primary-val">{selectedHospital.availableBeds}</strong>
                <span className="metric-unit">Ready for Admission</span>
              </div>
              <span className="metric-foot">Immediate Sanitized Beds</span>
            </div>

            {/* 4. ICU Capacity */}
            <div className="metric-box box-teal">
              <span className="metric-num-label">4. ICU Capacity</span>
              <div className="metric-val-row">
                <strong className="metric-primary-val">
                  {selectedHospital.icuFacilities?.availableBeds ?? selectedHospital.icuBedCapacity}
                </strong>
                <span className="metric-unit">/ {selectedHospital.icuBedCapacity} Total</span>
              </div>
              <span className="metric-foot">Critical Care &amp; Ventilator Units</span>
            </div>

            {/* 5. Available Emergency Beds */}
            <div className="metric-box box-red">
              <span className="metric-num-label">5. Available Emergency Beds</span>
              <div className="metric-val-row">
                <strong className="metric-primary-val">{selectedHospital.availableEmergencyBeds}</strong>
                <span className="metric-unit">
                  / {selectedHospital.emergencyFacilities?.bedCapacity || 10} Total
                </span>
              </div>
              <span className="metric-foot">Acute Trauma Bay</span>
            </div>

            {/* 6. Active Referral Requests */}
            <div 
              className="metric-box box-purple interactive-metric" 
              onClick={() => setActiveTab("incoming")}
              title="Click to view and triage incoming referrals"
            >
              <div className="metric-header-split">
                <span className="metric-num-label">6. Active Referrals</span>
                {pendingIncomingCount > 0 && (
                  <span className="live-pending-dot" title="Pending Action Required">● Action Req</span>
                )}
              </div>
              <div className="metric-val-row">
                <strong className="metric-primary-val">{selectedHospital.activeReferrals || pendingIncomingCount || 0}</strong>
                <span className="metric-unit">Pending Triage</span>
              </div>
              <span className="metric-foot clickable">Triage Incoming Referrals →</span>
            </div>

            {/* 7. Accepted Referrals */}
            <div className="metric-box box-emerald">
              <span className="metric-num-label">7. Accepted Referrals</span>
              <div className="metric-val-row">
                <strong className="metric-primary-val">{selectedHospital.acceptedReferrals || 0}</strong>
                <span className="metric-unit">Admitted</span>
              </div>
              <span className="metric-foot">Digital Passes Honored</span>
            </div>

            {/* 8. Rejected Referrals */}
            <div className="metric-box box-slate">
              <span className="metric-num-label">8. Rejected Referrals</span>
              <div className="metric-val-row">
                <strong className="metric-primary-val">{selectedHospital.rejectedReferrals || 0}</strong>
                <span className="metric-unit">Redirected</span>
              </div>
              <span className="metric-foot">Due to Capacity or Specialty</span>
            </div>
          </div>

          {/* ── RESOURCE MANAGEMENT SECTION ── */}
          <div className="dash-section-card resource-mgmt-card">
            <div className="section-title-wrap">
              <div>
                <h3 className="section-heading">Resource Management &amp; Department Availability</h3>
                <p className="section-subtext">
                  Update live status for hospital staff, surgical suites, and treatment units. Changes update immediately with an audit timestamp.
                </p>
              </div>
              <div className="status-legend">
                <span className="legend-chip ok">● Available</span>
                <span className="legend-chip limited">● Limited</span>
                <span className="legend-chip unavail">● Unavailable</span>
                <span className="legend-chip pending">● Awaiting verification</span>
              </div>
            </div>

            <div className="resource-status-table-wrap">
              <table className="resource-status-table">
                <thead>
                  <tr>
                    <th>Resource / Department Unit</th>
                    <th>Current Status</th>
                    <th>Update Status (Authorized Staff)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "generalBeds", label: "General Bed Availability", desc: "Sanitized ward and private recovery rooms" },
                    { key: "icuBeds", label: "ICU Bed Availability", desc: "Critical care suites with ventilator capability" },
                    { key: "emergencyBeds", label: "Emergency Bed Availability", desc: "24/7 Resuscitation & Trauma Receiving Bays" },
                    { key: "specialists", label: "Specialist Availability", desc: "On-call Laser Surgeons, Urologists, Proctologists" },
                    { key: "medicalEquipment", label: "Medical Equipment Availability", desc: "Diode Lasers, Holmium Lasers, 4K Laparoscopy, C-Arm" },
                    { key: "treatments", label: "Treatment & Procedure Availability", desc: "EVLA, HoLEP, LHP, Laparoscopy elective scheduling" },
                    { key: "operationTheatres", label: "Operation Theatre Availability", desc: "Modular Surgical Theatres & Anesthesia Workstations" },
                  ].map((item) => {
                    const currentStatus = selectedHospital.resourceStatus?.[item.key] || "Available";
                    return (
                      <tr key={item.key}>
                        <td>
                          <div className="res-name-cell">
                            <strong>{item.label}</strong>
                            <span>{item.desc}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge-live ${currentStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                            {currentStatus}
                          </span>
                        </td>
                        <td>
                          <div className="status-button-group">
                            {["Available", "Limited availability", "Unavailable", "Awaiting verification"].map((st) => (
                              <button
                                key={st}
                                type="button"
                                className={`st-toggle-btn ${st.toLowerCase().replace(/\s+/g, "-")} ${currentStatus === st ? "active-st" : ""}`}
                                onClick={() => handleResourceStatusChange(item.key, st)}
                              >
                                {st === "Limited availability" ? "Limited" : st}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── LIVE CAPACITY ADJUSTMENT FORM ── */}
          <div className="dash-section-card capacity-update-card">
            <div className="section-title-wrap">
              <div>
                <h3 className="section-heading">Update Live Capacity Telemetry</h3>
                <p className="section-subtext">
                  Modify current bed counts and referral statistics. Real-time validation prevents available capacity from exceeding configured capacity.
                </p>
              </div>
            </div>

            {capacityError && (
              <div className="dash-alert error">
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{capacityError}</span>
              </div>
            )}

            {capacitySuccess && (
              <div className="dash-alert success">
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{capacitySuccess}</span>
              </div>
            )}

            <form onSubmit={handleCapacitySubmit} className="capacity-form-grid">
              <div className="form-group">
                <label htmlFor="avail-beds-input">
                  Available General Beds * 
                  <span className="field-hint">(Max: {selectedHospital.generalBedCapacity})</span>
                </label>
                <input
                  id="avail-beds-input"
                  type="number"
                  min="0"
                  max={selectedHospital.generalBedCapacity}
                  value={capacityForm.availableBeds}
                  onChange={(e) => setCapacityForm({ ...capacityForm, availableBeds: e.target.value })}
                  className="dash-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="occ-beds-input">
                  Occupied General Beds *
                  <span className="field-hint">(Max: {selectedHospital.generalBedCapacity})</span>
                </label>
                <input
                  id="occ-beds-input"
                  type="number"
                  min="0"
                  max={selectedHospital.generalBedCapacity}
                  value={capacityForm.occupiedBeds}
                  onChange={(e) => setCapacityForm({ ...capacityForm, occupiedBeds: e.target.value })}
                  className="dash-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="icu-beds-input">
                  Available ICU Beds *
                  <span className="field-hint">(Max: {selectedHospital.icuBedCapacity})</span>
                </label>
                <input
                  id="icu-beds-input"
                  type="number"
                  min="0"
                  max={selectedHospital.icuBedCapacity}
                  value={capacityForm.availableIcuBeds}
                  onChange={(e) => setCapacityForm({ ...capacityForm, availableIcuBeds: e.target.value })}
                  className="dash-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="emerg-beds-input">
                  Available Emergency Beds *
                  <span className="field-hint">
                    (Max: {selectedHospital.emergencyFacilities?.bedCapacity || 10})
                  </span>
                </label>
                <input
                  id="emerg-beds-input"
                  type="number"
                  min="0"
                  max={selectedHospital.emergencyFacilities?.bedCapacity || 10}
                  value={capacityForm.availableEmergencyBeds}
                  onChange={(e) => setCapacityForm({ ...capacityForm, availableEmergencyBeds: e.target.value })}
                  className="dash-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="active-ref-input">Active Referral Requests</label>
                <input
                  id="active-ref-input"
                  type="number"
                  min="0"
                  value={capacityForm.activeReferrals}
                  onChange={(e) => setCapacityForm({ ...capacityForm, activeReferrals: e.target.value })}
                  className="dash-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="acc-ref-input">Accepted Referrals</label>
                <input
                  id="acc-ref-input"
                  type="number"
                  min="0"
                  value={capacityForm.acceptedReferrals}
                  onChange={(e) => setCapacityForm({ ...capacityForm, acceptedReferrals: e.target.value })}
                  className="dash-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="rej-ref-input">Rejected Referrals</label>
                <input
                  id="rej-ref-input"
                  type="number"
                  min="0"
                  value={capacityForm.rejectedReferrals}
                  onChange={(e) => setCapacityForm({ ...capacityForm, rejectedReferrals: e.target.value })}
                  className="dash-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="staff-name-input">Updater Staff Name *</label>
                <input
                  id="staff-name-input"
                  type="text"
                  value={capacityForm.staffName}
                  onChange={(e) => setCapacityForm({ ...capacityForm, staffName: e.target.value })}
                  placeholder="e.g. Dr. A. Sharma / Charge Nurse"
                  className="dash-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="staff-email-input">Authorized Staff Email *</label>
                <input
                  id="staff-email-input"
                  type="email"
                  value={capacityForm.staffEmail}
                  onChange={(e) => setCapacityForm({ ...capacityForm, staffEmail: e.target.value })}
                  placeholder="staff@hospital.med"
                  className="dash-input"
                  required
                />
              </div>

              <div className="form-action-full">
                <button
                  type="submit"
                  disabled={updatingCapacity}
                  className="relief-primary-btn"
                >
                  {updatingCapacity ? "Syncing with Database..." : "Save & Confirm Availability"}
                </button>
                <span className="submit-disclaimer">
                  Timestamp and updater email will be recorded. Availability will be marked as "Hospital Confirmed".
                </span>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION: INCOMING REFERRALS (HOSPITAL TRIAGE DESK)
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "incoming" && selectedHospital && (
        <section className="hosp-incoming-section">
          {/* Facility Selector & Auth Banner */}
          <div className="dash-facility-picker-bar">
            <div className="picker-left">
              <label htmlFor="incoming-hospital-select" className="picker-label">Active Hospital Desk:</label>
              <select
                id="incoming-hospital-select"
                value={selectedHospital.id}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                className="picker-select"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city}) — ID: {h.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="picker-right">
              <div className="auth-staff-chip">
                <span className="staff-icon">👤</span>
                <span className="staff-email">
                  {userEmail || selectedHospital.lastUpdatedByEmail || "Authorized Staff Session"}
                </span>
                <span className="staff-status-badge">Triage Authorized</span>
              </div>
            </div>
          </div>

          {/* Section Header & Live Capacity Brief */}
          <div className="incoming-header-banner">
            <div>
              <span className="subview-badge">Clinical Triage &amp; Admission Intake</span>
              <h2 className="incoming-title">Incoming Patient Referral Requests</h2>
              <p className="incoming-sub">
                Review structured clinical requirements, verify operating capacity, and explicitly accept, reject, or request additional diagnostic data.
              </p>
            </div>

            <div className="incoming-capacity-brief">
              <div className="icb-item">
                <span className="icb-k">Available Beds</span>
                <strong className={`icb-v ${selectedHospital.availableBeds > 0 ? "good" : "zero"}`}>
                  {selectedHospital.availableBeds} / {selectedHospital.generalBedCapacity}
                </strong>
              </div>
              <div className="icb-divider" />
              <div className="icb-item">
                <span className="icb-k">ICU Capacity</span>
                <strong className="icb-v">
                  {selectedHospital.icuFacilities?.availableBeds ?? selectedHospital.icuBedCapacity} Open
                </strong>
              </div>
              <div className="icb-divider" />
              <div className="icb-item">
                <span className="icb-k">Trauma Bay</span>
                <strong className="icb-v">{selectedHospital.availableEmergencyBeds} Open</strong>
              </div>
            </div>
          </div>

          {/* Filters Bar for Incoming Referrals */}
          <div className="incoming-filter-bar">
            <div className="ifb-left">
              <span className="filter-label">Filter Urgency:</span>
              <div className="filter-pill-group">
                {["all", "Emergency", "Urgent", "Routine"].map((urg) => (
                  <button
                    key={urg}
                    type="button"
                    className={`ifb-btn ${referralFilterUrgency === urg ? "active" : ""}`}
                    onClick={() => setReferralFilterUrgency(urg)}
                  >
                    {urg === "all" ? "All Urgency" : urg}
                  </button>
                ))}
              </div>
            </div>

            <div className="ifb-right">
              <label htmlFor="ref-status-filter" className="filter-label">Status:</label>
              <select
                id="ref-status-filter"
                value={referralFilterStatus}
                onChange={(e) => setReferralFilterStatus(e.target.value)}
                className="hosp-select-filter"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending Triage</option>
                <option value="Accepted">Accepted Admissions</option>
                <option value="Rejected">Declined Cases</option>
                <option value="Information Requested">Information Requested</option>
              </select>
            </div>
          </div>

          {/* Referral Cards Feed */}
          {loadingReferrals ? (
            <div className="hosp-loading-state">
              <div className="hosp-spinner" />
              <p>Loading incoming patient referrals for {selectedHospital.name}...</p>
            </div>
          ) : filteredIncomingReferrals.length === 0 ? (
            <div className="hosp-empty-state">
              <div className="empty-icon">📬</div>
              <h3>No incoming referrals matching current criteria</h3>
              <p>Referral requests directed to this surgical center will appear here in real time.</p>
            </div>
          ) : (
            <div className="incoming-referrals-feed">
              {filteredIncomingReferrals.map((r) => {
                const isEmergency = r.priority === "Emergency";
                const isUrgent = r.priority === "Urgent";
                const isAccepted = r.status === "Accepted";
                const isRejected = r.status === "Rejected";
                const isInfoReq = r.status === "Information Requested";

                return (
                  <div key={r.id} className={`incoming-ref-card ${isEmergency ? "card-emergency" : ""}`}>
                    {/* Top identification bar */}
                    <div className="irc-top-bar">
                      <div className="irc-ids">
                        <span className="mono-id">{r.id}</span>
                        <span className="patient-id-badge">MRN: {r.patient?.patientId || "N/A"}</span>
                        {r.isDemoData && <span className="demo-data-badge">Sample Demo</span>}
                      </div>

                      <div className="irc-status-badges">
                        <span className={`priority-badge ${r.priority?.toLowerCase()}`}>
                          {isEmergency ? "🚨 Level 1 Emergency" : isUrgent ? "⚡ Urgent" : "🟢 Routine"}
                        </span>
                        <span className={`status-pill-table ${r.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                          ● {r.status}
                        </span>
                      </div>
                    </div>

                    {/* Patient & Referring Doctor Information Grid */}
                    <div className="irc-details-grid">
                      {/* Patient Summary */}
                      <div className="irc-col-patient">
                        <span className="section-micro-label">Patient Demographics:</span>
                        <h3 className="patient-name">{r.patient?.name}</h3>
                        <p className="patient-sub">
                          {r.patient?.age} yrs • {r.patient?.gender} • Location: {r.patient?.location}
                        </p>
                        <p className="patient-contact">
                          📞 {r.patient?.contact} {r.patient?.emergencyContact ? `(Emergency: ${r.patient?.emergencyContact})` : ""}
                        </p>
                      </div>

                      {/* Clinical Requirements */}
                      <div className="irc-col-clinical">
                        <span className="section-micro-label">Required Clinical Procedure:</span>
                        <h4 className="proc-title">{r.clinicalRequirements?.procedure}</h4>
                        <span className="dept-tag">{r.clinicalRequirements?.specialty}</span>
                        <div className="fac-badges">
                          <span className={`fac-pill ${r.clinicalRequirements?.icuRequired ? "needed" : ""}`}>
                            ICU Required: {r.clinicalRequirements?.icuRequired ? "YES (Ventilator)" : "No"}
                          </span>
                          <span className={`fac-pill ${r.clinicalRequirements?.emergencySupportRequired ? "needed" : ""}`}>
                            Emergency Bay: {r.clinicalRequirements?.emergencySupportRequired ? "YES" : "No"}
                          </span>
                        </div>
                        <p className="diag-text">
                          <strong>Diagnosis:</strong> {r.clinicalRequirements?.diagnosis}
                        </p>
                      </div>

                      {/* Referring Doctor & Timestamp */}
                      <div className="irc-col-doctor">
                        <span className="section-micro-label">Referring Clinician:</span>
                        <strong className="doc-name">{r.doctorName || "Dr. Referring Clinician"}</strong>
                        <span className="doc-clinic">{r.doctorClinic}</span>
                        <span className="doc-email">{r.doctorId}</span>
                        <div className="referral-time-stamp">
                          🕒 Created {formatTimeAgo(r.createdAt)} ({new Date(r.createdAt).toLocaleDateString()})
                        </div>
                      </div>
                    </div>

                    {/* Clinical Facilities & Equipment Summary */}
                    <div className="irc-equipment-bar">
                      <div className="ieb-item">
                        <span className="ieb-k">Required Facilities:</span>
                        <span className="ieb-v">{r.clinicalRequirements?.hospitalFacilities || "Standard OT & Post-op Recovery"}</span>
                      </div>
                      <div className="ieb-item">
                        <span className="ieb-k">Required Specialist:</span>
                        <span className="ieb-v">{r.clinicalRequirements?.requiredSpecialist || "Attending Surgeon"}</span>
                      </div>
                      <div className="ieb-item">
                        <span className="ieb-k">Equipment:</span>
                        <span className="ieb-v">{r.clinicalRequirements?.equipmentRequirements || "Standard Surgical Lasers"}</span>
                      </div>
                    </div>

                    {/* Required Documents Bar (Accessible with authorization) */}
                    <div className="irc-docs-bar">
                      <div className="idb-left">
                        <span className="docs-auth-badge">
                          🔒 Clinical Records (Authorized Staff Access Only)
                        </span>
                        {r.documents && r.documents.length > 0 ? (
                          <div className="doc-chips-row">
                            {r.documents.map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                className="doc-chip-btn"
                                onClick={() => openDocViewer(doc, r)}
                                title="Click to view verified medical document"
                              >
                                📎 {doc.name} ({Math.round(doc.size / 1024)} KB)
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="no-docs-text">No digital reports attached to referral token.</span>
                        )}
                      </div>

                      {/* Status Badges or Direct Action Buttons */}
                      <div className="irc-actions-wrap">
                        {["Accepted", "Transfer Initiated", "Patient Arrived", "Completed"].includes(r.status) ? (
                          <div className="accepted-controls-stack">
                            <div className="accepted-banner-box">
                              <span className="abb-check">✓</span>
                              <div>
                                <strong>{r.status} • {r.acceptedBy || "Staff"}</strong>
                                <span className="abb-time">
                                  Prioritized at {new Date(r.acceptedAt || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {r.capacityHold?.held && r.capacityHold?.status === "Active" && ` • Hold Active until ${new Date(r.capacityHold.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                  {r.capacityHold?.status === "Released" && " • Hold Released"}
                                  {r.capacityHold?.status === "Expired" && " • Hold Expired"}
                                </span>
                              </div>
                            </div>

                            <div className="journey-control-row">
                              {r.capacityHold?.held && r.capacityHold?.status === "Active" && r.status !== "Completed" && (
                                <button
                                  type="button"
                                  className="hold-release-btn"
                                  onClick={() => handleReleaseHold(r)}
                                  title="Cancel and release reserved bed back to hospital capacity"
                                >
                                  Release Bed Hold
                                </button>
                              )}
                              {r.status === "Accepted" && (
                                <button
                                  type="button"
                                  className="journey-step-btn"
                                  onClick={() => handleAdvanceJourney(r, "Transfer Initiated")}
                                >
                                  Mark Transfer Initiated →
                                </button>
                              )}
                              {r.status === "Transfer Initiated" && (
                                <button
                                  type="button"
                                  className="journey-step-btn"
                                  onClick={() => handleAdvanceJourney(r, "Patient Arrived")}
                                >
                                  Confirm Patient Arrived →
                                </button>
                              )}
                              {r.status === "Patient Arrived" && (
                                <button
                                  type="button"
                                  className="journey-step-btn confirm"
                                  onClick={() => handleAdvanceJourney(r, "Completed")}
                                >
                                  Confirm Admission ✓
                                </button>
                              )}
                            </div>
                          </div>
                        ) : isRejected ? (
                          <div className="rejected-banner-box">
                            <span className="rbb-cross">✕</span>
                            <div>
                              <strong>Declined: {r.rejectionReason}</strong>
                              <span className="rbb-by">By {r.rejectedBy || "Staff"} at {new Date(r.rejectedAt || r.createdAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="action-buttons-row">
                            <button
                              type="button"
                              className="act-btn-info"
                              onClick={() => openInfoModal(r)}
                            >
                              Request More Info
                            </button>

                            <button
                              type="button"
                              className="act-btn-reject"
                              onClick={() => openRejectModal(r)}
                            >
                              Reject Referral
                            </button>

                            <button
                              type="button"
                              className="act-btn-accept"
                              onClick={() => openAcceptModal(r)}
                            >
                              Accept Referral →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL 1: ACCEPT REFERRAL WITH CAPACITY RECHECK
      ═════════════════════════════════════════════════════════════════════ */}
      {activeModal === "accept" && targetReferral && selectedHospital && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-accept">
            <div className="modal-head">
              <div>
                <span className="modal-sub-badge">Authorized Hospital Intake</span>
                <h3 className="modal-title">Accept Patient Referral: {targetReferral.id}</h3>
                <span className="modal-subtext">Patient: {targetReferral.patient?.name} ({targetReferral.patient?.age} yrs)</span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            {actionError && (
              <div className="dash-alert error">
                <span>⚠️ {actionError}</span>
              </div>
            )}
            {actionSuccess && (
              <div className="dash-alert success">
                <span>✓ {actionSuccess}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAccept} className="modal-body-form">
              {/* Live Capacity Recheck Checklist */}
              <div className="recheck-capacity-box">
                <span className="section-micro-label">Capacity &amp; Facility Recheck:</span>
                <div className="recheck-grid">
                  <div className={`recheck-item ${selectedHospital.availableBeds > 0 ? "pass" : "fail"}`}>
                    <span className="ri-icon">{selectedHospital.availableBeds > 0 ? "✓" : "✕"}</span>
                    <div>
                      <strong>General Beds: {selectedHospital.availableBeds} Available</strong>
                      <span>Hospital total: {selectedHospital.generalBedCapacity} configured</span>
                    </div>
                  </div>

                  <div className={`recheck-item ${(selectedHospital.icuFacilities?.availableBeds ?? 1) > 0 ? "pass" : "warn"}`}>
                    <span className="ri-icon">{(selectedHospital.icuFacilities?.availableBeds ?? 1) > 0 ? "✓" : "⚠️"}</span>
                    <div>
                      <strong>ICU Critical Care: {selectedHospital.icuFacilities?.availableBeds ?? selectedHospital.icuBedCapacity} Beds</strong>
                      <span>{targetReferral.clinicalRequirements?.icuRequired ? "Required for this case" : "Elective/Optional"}</span>
                    </div>
                  </div>

                  <div className="recheck-item pass">
                    <span className="ri-icon">✓</span>
                    <div>
                      <strong>Specialist Coverage: {selectedHospital.resourceStatus?.specialists || "Available"}</strong>
                      <span>Specialty: {targetReferral.clinicalRequirements?.specialty}</span>
                    </div>
                  </div>

                  <div className="recheck-item pass">
                    <span className="ri-icon">✓</span>
                    <div>
                      <strong>Procedure Readiness</strong>
                      <span>{targetReferral.clinicalRequirements?.procedure}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Authorized Staff Credentials */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="acc-staff-name">Authorized Staff Member *</label>
                  <input
                    id="acc-staff-name"
                    type="text"
                    required
                    value={acceptForm.staffName}
                    onChange={(e) => setAcceptForm({ ...acceptForm, staffName: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="acc-staff-email">Staff Official Email *</label>
                  <input
                    id="acc-staff-email"
                    type="email"
                    required
                    value={acceptForm.staffEmail}
                    onChange={(e) => setAcceptForm({ ...acceptForm, staffEmail: e.target.value })}
                    className="dash-input"
                  />
                </div>
              </div>

              {/* Capacity Hold Option */}
              <div className="capacity-hold-toggle-card">
                <label className="checkbox-label-block">
                  <input
                    type="checkbox"
                    checked={acceptForm.authorizeCapacityHold}
                    onChange={(e) => setAcceptForm({ ...acceptForm, authorizeCapacityHold: e.target.checked })}
                  />
                  <div>
                    <strong>Authorize Immediate Capacity Hold</strong>
                    <p>
                      Atomically reserve 1 bed in the hospital database. Available capacity will be decremented and occupied count incremented.
                    </p>
                  </div>
                </label>
              </div>

              {/* Clinical Triaging Notes */}
              <div className="form-group">
                <label htmlFor="acc-clinical-notes">Admission / Clinical Triaging Notes</label>
                <textarea
                  id="acc-clinical-notes"
                  rows="2"
                  placeholder="e.g. Bed assigned to Surgical Ward 4B. Patient advised NPO from midnight. Dr. Mehta informed."
                  value={acceptForm.clinicalNotes}
                  onChange={(e) => setAcceptForm({ ...acceptForm, clinicalNotes: e.target.value })}
                  className="dash-input textarea"
                />
              </div>

              {/* Safety Rule Notice */}
              <div className="safety-disclaimer-banner">
                <strong>Clinical Notice:</strong> Acceptance authorizes admission prioritization and bed reservation. Unconditional admission is subject to bedside clinical evaluation upon presentation.
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={actionSubmitting} className="relief-primary-btn">
                  {actionSubmitting ? "Confirming & Reserving..." : "Confirm & Accept Referral"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL 2: REJECT REFERRAL WITH MANDATORY REASON
      ═════════════════════════════════════════════════════════════════════ */}
      {activeModal === "reject" && targetReferral && selectedHospital && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-reject">
            <div className="modal-head">
              <div>
                <span className="modal-sub-badge warn">Clinical Triage Decline</span>
                <h3 className="modal-title">Decline Patient Referral: {targetReferral.id}</h3>
                <span className="modal-subtext">Patient: {targetReferral.patient?.name} • Specialty: {targetReferral.clinicalRequirements?.specialty}</span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            {actionError && (
              <div className="dash-alert error">
                <span>⚠️ {actionError}</span>
              </div>
            )}
            {actionSuccess && (
              <div className="dash-alert success">
                <span>✓ {actionSuccess}</span>
              </div>
            )}

            <form onSubmit={handleConfirmReject} className="modal-body-form">
              <div className="form-group">
                <label htmlFor="rej-reason-select">Mandatory Rejection Reason *</label>
                <select
                  id="rej-reason-select"
                  required
                  value={rejectForm.rejectionReason}
                  onChange={(e) => setRejectForm({ ...rejectForm, rejectionReason: e.target.value })}
                  className="dash-input"
                >
                  {VALID_REJECTION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <span className="field-hint">Reason will be transmitted directly to referring physician.</span>
              </div>

              <div className="form-group">
                <label htmlFor="rej-notes">Clinical Justification &amp; Alternate Recommendations</label>
                <textarea
                  id="rej-notes"
                  rows="3"
                  placeholder="Provide clinical context or advise alternate surgical centers..."
                  value={rejectForm.clinicalNotes}
                  onChange={(e) => setRejectForm({ ...rejectForm, clinicalNotes: e.target.value })}
                  className="dash-input textarea"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="rej-staff-name">Staff Member Declining *</label>
                  <input
                    id="rej-staff-name"
                    type="text"
                    required
                    value={rejectForm.staffName}
                    onChange={(e) => setRejectForm({ ...rejectForm, staffName: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rej-staff-email">Official Staff Email *</label>
                  <input
                    id="rej-staff-email"
                    type="email"
                    required
                    value={rejectForm.staffEmail}
                    onChange={(e) => setRejectForm({ ...rejectForm, staffEmail: e.target.value })}
                    className="dash-input"
                  />
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={actionSubmitting} className="act-btn-reject-confirm">
                  {actionSubmitting ? "Transmitting..." : "Confirm & Reject Referral"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL 3: REQUEST MORE INFORMATION
      ═════════════════════════════════════════════════════════════════════ */}
      {activeModal === "request_info" && targetReferral && selectedHospital && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-info">
            <div className="modal-head">
              <div>
                <span className="modal-sub-badge info">Clinical Documentation Request</span>
                <h3 className="modal-title">Request More Information: {targetReferral.id}</h3>
                <span className="modal-subtext">Referring Clinician: {targetReferral.doctorName} ({targetReferral.doctorClinic})</span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            {actionError && (
              <div className="dash-alert error">
                <span>⚠️ {actionError}</span>
              </div>
            )}
            {actionSuccess && (
              <div className="dash-alert success">
                <span>✓ {actionSuccess}</span>
              </div>
            )}

            <form onSubmit={handleConfirmRequestInfo} className="modal-body-form">
              <div className="form-group">
                <label htmlFor="req-info-title">Required Document or Clinical Detail *</label>
                <input
                  id="req-info-title"
                  type="text"
                  required
                  placeholder="e.g. Recent Coagulation Profile / INR, NCCT Pelvis, or 2D Echo report"
                  value={infoForm.requestedInfo}
                  onChange={(e) => setInfoForm({ ...infoForm, requestedInfo: e.target.value })}
                  className="dash-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="req-info-msg">Message to Referring Physician</label>
                <textarea
                  id="req-info-msg"
                  rows="3"
                  placeholder="Explain why this clinical investigation is required before confirming surgical admission..."
                  value={infoForm.message}
                  onChange={(e) => setInfoForm({ ...infoForm, message: e.target.value })}
                  className="dash-input textarea"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="info-staff-name">Staff Member Requesting *</label>
                  <input
                    id="info-staff-name"
                    type="text"
                    required
                    value={infoForm.staffName}
                    onChange={(e) => setInfoForm({ ...infoForm, staffName: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="info-staff-email">Staff Email *</label>
                  <input
                    id="info-staff-email"
                    type="email"
                    required
                    value={infoForm.staffEmail}
                    onChange={(e) => setInfoForm({ ...infoForm, staffEmail: e.target.value })}
                    className="dash-input"
                  />
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={actionSubmitting} className="act-btn-info-confirm">
                  {actionSubmitting ? "Transmitting..." : "Send Request to Doctor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL 4: AUTHORIZED DOCUMENT VIEWER
      ═════════════════════════════════════════════════════════════════════ */}
      {activeModal === "view_docs" && activeDocToView && targetReferral && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-doc-view">
            <div className="modal-head">
              <div>
                <span className="docs-auth-badge">🔒 Authorized Health Record Inspection</span>
                <h3 className="modal-title">{activeDocToView.name}</h3>
                <span className="modal-subtext">Attached to Referral {targetReferral.id} • Patient: {targetReferral.patient?.name}</span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <div className="doc-view-body">
              <div className="doc-meta-card">
                <div className="dmc-row">
                  <span className="dmc-k">Document Category:</span>
                  <strong className="dmc-v">{activeDocToView.category || "Clinical Diagnostic Report"}</strong>
                </div>
                <div className="dmc-row">
                  <span className="dmc-k">File Format &amp; Size:</span>
                  <span className="dmc-v">{activeDocToView.type} • {Math.round(activeDocToView.size / 1024)} KB</span>
                </div>
                <div className="dmc-row">
                  <span className="dmc-k">Uploaded At:</span>
                  <span className="dmc-v">{new Date(activeDocToView.uploadedAt).toLocaleString()}</span>
                </div>
                {activeDocToView.clinicalSummary && (
                  <div className="dmc-row">
                    <span className="dmc-k">Clinical Summary:</span>
                    <span className="dmc-v highlight">{activeDocToView.clinicalSummary}</span>
                  </div>
                )}
              </div>

              <div className="doc-preview-mock">
                <span className="dpm-icon">📄</span>
                <h4>Clinical Document Verified &amp; Encrypted</h4>
                <p>Digital medical report securely stored in hospital referral vault. Access logged for compliance.</p>
                <button
                  type="button"
                  className="relief-primary-btn compact"
                  onClick={() => alert(`Document "${activeDocToView.name}" ready for clinician review.`)}
                >
                  Download / Open Document
                </button>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          HOSPITAL REGISTRATION FORM
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "register" && (
        <section className="hosp-register-section">
          <div className="reg-header-card">
            <span className="subview-badge">Hospital Onboarding</span>
            <h2 className="reg-title">Register Healthcare Facility in Relief Laser Health Network</h2>
            <p className="reg-subtitle">
              Join the certified hospital referral network. Every registered hospital receives an immutable unique identifier and live telemetry dashboard.
            </p>
          </div>

          {regError && (
            <div className="dash-alert error">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{regError}</span>
            </div>
          )}

          {regSuccess && (
            <div className="dash-alert success">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{regSuccess}</span>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="reg-form-card">
            {/* Group 1: General & Verification Information */}
            <div className="reg-form-part">
              <h3 className="part-title">1. Hospital Identification &amp; Accreditation</h3>
              <div className="reg-grid-2">
                <div className="form-group">
                  <label htmlFor="reg-hosp-name">Hospital Name *</label>
                  <input
                    id="reg-hosp-name"
                    type="text"
                    required
                    placeholder="e.g. Fortis Laser & Multispecialty Hospital"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-hosp-num">Registration / Verification Info (NABH / Rohini / State Reg) *</label>
                  <input
                    id="reg-hosp-num"
                    type="text"
                    required
                    placeholder="e.g. NABH-2024-DEL-9901"
                    value={regForm.regNumber}
                    onChange={(e) => setRegForm({ ...regForm, regNumber: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-hosp-type">Hospital Type *</label>
                  <select
                    id="reg-hosp-type"
                    value={regForm.hospitalType}
                    onChange={(e) => setRegForm({ ...regForm, hospitalType: e.target.value })}
                    className="dash-input"
                  >
                    <option value="Super Specialty & Advanced Laser Center">Super Specialty &amp; Advanced Laser Center</option>
                    <option value="Multispecialty Surgical Center">Multispecialty Surgical Center</option>
                    <option value="Tertiary Care Academic Hospital">Tertiary Care Academic Hospital</option>
                    <option value="Specialized Laser Clinic & Daycare">Specialized Laser Clinic &amp; Daycare</option>
                    <option value="District / General Hospital">District / General Hospital</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-hosp-creator">Registrar Staff Name *</label>
                  <input
                    id="reg-hosp-creator"
                    type="text"
                    value={regForm.creatorName}
                    onChange={(e) => setRegForm({ ...regForm, creatorName: e.target.value })}
                    placeholder="e.g. Dr. Rajesh Verma (Medical Superintendent)"
                    className="dash-input"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Group 2: Location & Contact */}
            <div className="reg-form-part">
              <h3 className="part-title">2. Address &amp; Geo-Coordinates</h3>
              <div className="reg-grid-3">
                <div className="form-group span-3">
                  <label htmlFor="reg-address">Street Address *</label>
                  <input
                    id="reg-address"
                    type="text"
                    required
                    placeholder="Building, Street, Landmark"
                    value={regForm.address}
                    onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-city">City *</label>
                  <input
                    id="reg-city"
                    type="text"
                    required
                    placeholder="e.g. New Delhi"
                    value={regForm.city}
                    onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-state">State *</label>
                  <input
                    id="reg-state"
                    type="text"
                    required
                    placeholder="e.g. Delhi"
                    value={regForm.state}
                    onChange={(e) => setRegForm({ ...regForm, state: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-pin">PIN Code *</label>
                  <input
                    id="reg-pin"
                    type="text"
                    required
                    placeholder="e.g. 110001"
                    value={regForm.pincode}
                    onChange={(e) => setRegForm({ ...regForm, pincode: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-lat">Latitude (Optional)</label>
                  <input
                    id="reg-lat"
                    type="number"
                    step="any"
                    placeholder="e.g. 28.6139"
                    value={regForm.latitude}
                    onChange={(e) => setRegForm({ ...regForm, latitude: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-lng">Longitude (Optional)</label>
                  <input
                    id="reg-lng"
                    type="number"
                    step="any"
                    placeholder="e.g. 77.2090"
                    value={regForm.longitude}
                    onChange={(e) => setRegForm({ ...regForm, longitude: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-phone">Emergency Contact Number *</label>
                  <input
                    id="reg-phone"
                    type="tel"
                    required
                    placeholder="+91 11 4000 0000"
                    value={regForm.contactPhone}
                    onChange={(e) => setRegForm({ ...regForm, contactPhone: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group span-2">
                  <label htmlFor="reg-email">Official Hospital Email *</label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="admissions@hospital.med"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="dash-input"
                  />
                </div>
              </div>
            </div>

            {/* Group 3: Clinical Capabilities */}
            <div className="reg-form-part">
              <h3 className="part-title">3. Departments, Treatments &amp; Medical Equipment</h3>
              <div className="form-group">
                <label htmlFor="reg-depts">Departments (Comma-separated) *</label>
                <textarea
                  id="reg-depts"
                  rows="2"
                  value={regForm.departments}
                  onChange={(e) => setRegForm({ ...regForm, departments: e.target.value })}
                  placeholder="Laser Surgery, Proctology, Laparoscopy, Urology, Orthopedics, Cardiology"
                  className="dash-input textarea"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-treatments">Available Treatments &amp; Laser Procedures *</label>
                <textarea
                  id="reg-treatments"
                  rows="2"
                  value={regForm.availableTreatments}
                  onChange={(e) => setRegForm({ ...regForm, availableTreatments: e.target.value })}
                  placeholder="Laser Hemorrhoidoplasty, Laser Varicose Veins (EVLA), Laser Fissurectomy, HoLEP"
                  className="dash-input textarea"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-equip">Available Medical &amp; Laser Equipment *</label>
                <textarea
                  id="reg-equip"
                  rows="2"
                  value={regForm.medicalEquipment}
                  onChange={(e) => setRegForm({ ...regForm, medicalEquipment: e.target.value })}
                  placeholder="1470nm Dual Diode Laser, 100W Holmium Laser, 4K Laparoscopy System, C-Arm"
                  className="dash-input textarea"
                  required
                />
              </div>
            </div>

            {/* Group 4: Bed Capacities, ICU & Emergency Facilities */}
            <div className="reg-form-part">
              <h3 className="part-title">4. Facilities &amp; Bed Capacity Ceiling</h3>
              <div className="reg-grid-2">
                <div className="form-group">
                  <label htmlFor="reg-gen-cap">General Bed Capacity *</label>
                  <input
                    id="reg-gen-cap"
                    type="number"
                    min="1"
                    required
                    value={regForm.generalBedCapacity}
                    onChange={(e) => setRegForm({ ...regForm, generalBedCapacity: e.target.value })}
                    className="dash-input"
                  />
                  <span className="field-hint">Defines the maximum ceiling for general ward and room capacity.</span>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-init-occ">Initial Occupied Beds</label>
                  <input
                    id="reg-init-occ"
                    type="number"
                    min="0"
                    max={regForm.generalBedCapacity}
                    value={regForm.occupiedBeds}
                    onChange={(e) => setRegForm({ ...regForm, occupiedBeds: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-icu-cap">ICU Bed Capacity *</label>
                  <input
                    id="reg-icu-cap"
                    type="number"
                    min="0"
                    required
                    value={regForm.icuBedCapacity}
                    onChange={(e) => setRegForm({ ...regForm, icuBedCapacity: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-emerg-cap">Emergency Bed Capacity *</label>
                  <input
                    id="reg-emerg-cap"
                    type="number"
                    min="0"
                    required
                    value={regForm.emergencyBedCapacity}
                    onChange={(e) => setRegForm({ ...regForm, emergencyBedCapacity: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group span-2">
                  <label htmlFor="reg-icu-details">ICU Facilities Description</label>
                  <input
                    id="reg-icu-details"
                    type="text"
                    value={regForm.icuDetails}
                    onChange={(e) => setRegForm({ ...regForm, icuDetails: e.target.value })}
                    placeholder="e.g. 24/7 Negative pressure isolation with ventilators"
                    className="dash-input"
                  />
                </div>

                <div className="form-group span-2">
                  <label htmlFor="reg-emerg-details">Emergency Facilities Description</label>
                  <input
                    id="reg-emerg-details"
                    type="text"
                    value={regForm.emergencyDetails}
                    onChange={(e) => setRegForm({ ...regForm, emergencyDetails: e.target.value })}
                    placeholder="e.g. Level-1 Trauma Center with 24/7 acute surgeon availability"
                    className="dash-input"
                  />
                </div>
              </div>
            </div>

            <div className="form-action-full">
              <button
                type="submit"
                disabled={registering}
                className="relief-primary-btn"
              >
                {registering ? "Registering Facility..." : "Complete Hospital Registration"}
              </button>
              <span className="submit-disclaimer">
                A unique permanent ID will be assigned and database record created. You will be redirected to the Management Dashboard.
              </span>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

