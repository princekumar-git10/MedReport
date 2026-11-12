import { db } from "../firebase.js";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc,
  runTransaction,
  onSnapshot
} from "firebase/firestore";

const STORAGE_KEY = "relief_laser_health_hospitals_v1";
const FIRESTORE_COLLECTION = "relief_hospitals";

// Initial demonstration data for development & demo purposes, clearly labeled.
const DEMO_HOSPITALS = [
  {
    id: "HOSP-RLH-001",
    isDemoData: true,
    sourceNote: "Demonstration Data (Sample Network Demo)",
    name: "Apollo Laser & Multi-Specialty Hospital",
    regNumber: "NABH-2024-DEL-8941",
    address: "Plot 14, Health City, Sector 62",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    coordinates: { lat: 28.6139, lng: 77.2090 },
    contactPhone: "+91 11 4982 3000",
    email: "emergency@apollolaser.med",
    hospitalType: "Super Specialty & Advanced Laser Center",
    departments: [
      "Laser Surgery",
      "Laser Proctology",
      "Laparoscopic Surgery",
      "Laser Urology",
      "Cardiology",
      "Critical Care"
    ],
    availableTreatments: [
      "Laser Hemorrhoidoplasty (LHP)",
      "Laser Varicose Vein Ablation (EVLA)",
      "Holmium Laser Enucleation of Prostate (HoLEP)",
      "Laser Fissurectomy",
      "Laparoscopic Hernia Repair",
      "Laser Kidney Stone Lithotripsy"
    ],
    medicalEquipment: [
      "1470nm Dual-Wavelength Diode Laser",
      "100W Holmium:YAG High-Power Laser",
      "4K Ultra-HD Laparoscopic Tower",
      "3D C-Arm Fluoroscopy",
      "High-End ICU Ventilators"
    ],
    emergencyFacilities: {
      available: true,
      details: "24/7 Level-1 Trauma & Emergency Admission Desk",
      bedCapacity: 15,
      availableBeds: 6
    },
    icuFacilities: {
      available: true,
      details: "Cardiac & Surgical ICU with Negative Pressure Isolation",
      bedCapacity: 20,
      availableBeds: 5
    },
    generalBedCapacity: 120,
    occupiedBeds: 85,
    availableBeds: 35,
    icuBedCapacity: 20,
    availableEmergencyBeds: 6,
    activeReferrals: 4,
    acceptedReferrals: 42,
    rejectedReferrals: 2,
    confirmedByHospital: true,
    lastUpdatedBy: "Dr. Arvind Mehta (Chief of Surgery)",
    lastUpdatedByEmail: "dr.arvind@apollolaser.med",
    lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    resourceStatus: {
      generalBeds: "Available",
      icuBeds: "Limited availability",
      emergencyBeds: "Available",
      specialists: "Available",
      medicalEquipment: "Available",
      treatments: "Available",
      operationTheatres: "Limited availability"
    },
    authorizedStaff: ["dr.arvind@apollolaser.med", "admin@apollolaser.med"]
  },
  {
    id: "HOSP-RLH-002",
    isDemoData: true,
    sourceNote: "Demonstration Data (Sample Network Demo)",
    name: "Max Super Specialty & Laser Surgical Institute",
    regNumber: "ROHINI-2023-MUM-4412",
    address: "Bandra Kurla Complex, Hospital Road",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400051",
    coordinates: { lat: 19.0760, lng: 72.8777 },
    contactPhone: "+91 22 6150 7000",
    email: "desk@maxlasermum.med",
    hospitalType: "Multispecialty Surgical Center",
    departments: [
      "Laser Proctology",
      "Laser Gynecology",
      "Vascular Surgery",
      "Urology",
      "Daycare Surgery"
    ],
    availableTreatments: [
      "Endovenous Laser Therapy (EVLT)",
      "Laser Pilonidal Sinus Treatment (SiLaC)",
      "Laser Fistula Closure (FiLaC)",
      "Laser Circumcision",
      "Laser Ureteroscopy"
    ],
    medicalEquipment: [
      "Leonardo Dual Laser 45",
      "CO2 Fractional Surgical Laser",
      "GE C-Arm Mobile Fluoroscopy",
      "Philips Multi-parameter Patient Monitors"
    ],
    emergencyFacilities: {
      available: true,
      details: "24/7 Acute Surgical Emergency Receiving",
      bedCapacity: 10,
      availableBeds: 3
    },
    icuFacilities: {
      available: true,
      details: "12-Bed Modern Surgical ICU",
      bedCapacity: 12,
      availableBeds: 2
    },
    generalBedCapacity: 80,
    occupiedBeds: 68,
    availableBeds: 12,
    icuBedCapacity: 12,
    availableEmergencyBeds: 3,
    activeReferrals: 3,
    acceptedReferrals: 31,
    rejectedReferrals: 1,
    confirmedByHospital: true,
    lastUpdatedBy: "Nurse Supervisor R. Shinde",
    lastUpdatedByEmail: "desk@maxlasermum.med",
    lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    resourceStatus: {
      generalBeds: "Limited availability",
      icuBeds: "Limited availability",
      emergencyBeds: "Available",
      specialists: "Available",
      medicalEquipment: "Available",
      treatments: "Available",
      operationTheatres: "Available"
    },
    authorizedStaff: ["desk@maxlasermum.med", "director@maxlasermum.med"]
  },
  {
    id: "HOSP-RLH-003",
    isDemoData: true,
    sourceNote: "Demonstration Data (Sample Network Demo)",
    name: "Manipal Institute of Laser & Robotic Surgery",
    regNumber: "NABH-2022-BLR-1198",
    address: "HAL Old Airport Road, Kodihalli",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560017",
    coordinates: { lat: 12.9716, lng: 77.5946 },
    contactPhone: "+91 80 2502 4444",
    email: "admissions@manipallaser.med",
    hospitalType: "Super Specialty Tertiary Care",
    departments: [
      "Laser Urology",
      "Robotic & Laparoscopic Surgery",
      "Laser Cosmetology",
      "General Surgery",
      "Emergency Medicine"
    ],
    availableTreatments: [
      "Thulium Fiber Laser Prostate Surgery (ThuFLEP)",
      "Laser Renal Calculus Fragmentation",
      "Laser Varicose Vein Ablation",
      "Robotic Cholecystectomy",
      "Laser Skin Lesion Excision"
    ],
    medicalEquipment: [
      "Thulium Fiber Laser SuperPulsed",
      "da Vinci Xi Surgical System",
      "Olympus 4K Visera Elite Laparoscopy",
      "Mindray A7 Anesthesia Workstation"
    ],
    emergencyFacilities: {
      available: true,
      details: "Level-1 24/7 Trauma and Resuscitation Suite",
      bedCapacity: 18,
      availableBeds: 8
    },
    icuFacilities: {
      available: true,
      details: "Comprehensive 25-Bed Medical & Surgical ICU",
      bedCapacity: 25,
      availableBeds: 7
    },
    generalBedCapacity: 150,
    occupiedBeds: 110,
    availableBeds: 40,
    icuBedCapacity: 25,
    availableEmergencyBeds: 8,
    activeReferrals: 6,
    acceptedReferrals: 58,
    rejectedReferrals: 3,
    confirmedByHospital: false, // Example of reported / awaiting verification
    lastUpdatedBy: "Care Coordinator K. Nair",
    lastUpdatedByEmail: "admissions@manipallaser.med",
    lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    resourceStatus: {
      generalBeds: "Available",
      icuBeds: "Available",
      emergencyBeds: "Available",
      specialists: "Limited availability",
      medicalEquipment: "Available",
      treatments: "Available",
      operationTheatres: "Awaiting verification"
    },
    authorizedStaff: ["admissions@manipallaser.med"]
  }
];

// Helper: Read hospitals from local cache/storage
export function getLocalHospitals() {
  try {
    if (typeof localStorage === "undefined") return DEMO_HOSPITALS;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_HOSPITALS));
      return DEMO_HOSPITALS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEMO_HOSPITALS;
  } catch (e) {
    console.error("Local hospitals read error:", e);
    return DEMO_HOSPITALS;
  }
}

// Helper: Save hospitals to local cache
export function saveLocalHospitals(list) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    // Dispatch custom event for real-time reactivity in current window
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("relief_hospitals_updated", { detail: list }));
    }
  } catch (e) {
    console.error("Local hospitals write error:", e);
  }
}

// Helper: timeout wrapper to prevent slow or offline cloud requests from blocking local database
function withTimeout(promise, ms = 2000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Cloud sync timed out")), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeout
  ]);
}

/**
 * Fetch all hospitals from Firestore (with automatic fallback to local persistent storage).
 */
export async function getHospitals() {
  // If Firestore is available and accessible, attempt to sync from cloud with timeout
  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    try {
      const qSnap = await withTimeout(getDocs(collection(db, FIRESTORE_COLLECTION)), 2000);
      if (!qSnap.empty) {
        const cloudList = [];
        qSnap.forEach(docSnap => {
          cloudList.push({ id: docSnap.id, ...docSnap.data() });
        });
        saveLocalHospitals(cloudList);
        return cloudList;
      }
    } catch (err) {
      console.warn("Firestore fetch error/timeout, using local database:", err.message);
    }
  }

  return getLocalHospitals();
}

/**
 * Fetch a single hospital by ID
 */
export async function getHospitalById(id) {
  const all = await getHospitals();
  return all.find(h => h.id === id) || null;
}

/**
 * Register a new hospital.
 * Ensures a unique ID is generated, capacity rules are validated, and creator details are stored.
 */
export async function registerHospital(formData, creatorEmail = "staff@hospital.med") {
  // Generate unique hospital ID
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const uniqueId = `HOSP-RLH-${timestamp}-${randomPart}`;

  // Sanitize and validate capacity numbers
  const generalBedCapacity = Math.max(1, parseInt(formData.generalBedCapacity, 10) || 20);
  const icuBedCapacity = Math.max(0, parseInt(formData.icuBedCapacity, 10) || 4);
  const emergencyBedCapacity = Math.max(0, parseInt(formData.emergencyBedCapacity, 10) || 5);
  
  // Initial occupancy defaults
  const occupiedBeds = Math.min(generalBedCapacity, parseInt(formData.occupiedBeds, 10) || 0);
  const availableBeds = Math.max(0, generalBedCapacity - occupiedBeds);
  const availableEmergencyBeds = emergencyBedCapacity;

  const newHospital = {
    id: uniqueId,
    isDemoData: false,
    sourceNote: "Registered Hospital Facility",
    name: formData.name.trim(),
    regNumber: formData.regNumber?.trim() || `REG-${Date.now().toString().slice(-6)}`,
    address: formData.address?.trim() || "",
    city: formData.city?.trim() || "Unspecified City",
    state: formData.state?.trim() || "Unspecified State",
    pincode: formData.pincode?.trim() || "",
    coordinates: {
      lat: parseFloat(formData.latitude) || null,
      lng: parseFloat(formData.longitude) || null,
    },
    contactPhone: formData.contactPhone?.trim() || "",
    email: formData.email?.trim() || creatorEmail,
    hospitalType: formData.hospitalType || "Multispecialty Hospital",
    departments: Array.isArray(formData.departments) 
      ? formData.departments 
      : (formData.departments || "").split(",").map(d => d.trim()).filter(Boolean),
    availableTreatments: Array.isArray(formData.availableTreatments)
      ? formData.availableTreatments
      : (formData.availableTreatments || "").split(",").map(t => t.trim()).filter(Boolean),
    medicalEquipment: Array.isArray(formData.medicalEquipment)
      ? formData.medicalEquipment
      : (formData.medicalEquipment || "").split(",").map(e => e.trim()).filter(Boolean),
    emergencyFacilities: {
      available: Boolean(formData.emergencyAvailable),
      details: formData.emergencyDetails || "Emergency Services",
      bedCapacity: emergencyBedCapacity,
      availableBeds: availableEmergencyBeds,
    },
    icuFacilities: {
      available: Boolean(formData.icuAvailable),
      details: formData.icuDetails || "ICU Facility",
      bedCapacity: icuBedCapacity,
      availableBeds: icuBedCapacity,
    },
    generalBedCapacity,
    occupiedBeds,
    availableBeds,
    icuBedCapacity,
    availableEmergencyBeds,
    activeReferrals: 0,
    acceptedReferrals: 0,
    rejectedReferrals: 0,
    confirmedByHospital: true,
    verificationStatus: formData.verificationStatus || "Pending Verification",
    verifiedAt: formData.verificationStatus === "Verified" ? new Date().toISOString() : null,
    verifiedBy: formData.verificationStatus === "Verified" ? creatorEmail : null,
    lastUpdatedBy: formData.creatorName || creatorEmail,
    lastUpdatedByEmail: creatorEmail,
    lastUpdatedAt: new Date().toISOString(),
    resourceStatus: {
      generalBeds: availableBeds > 0 ? "Available" : "Unavailable",
      icuBeds: icuBedCapacity > 0 ? "Available" : "Unavailable",
      emergencyBeds: emergencyBedCapacity > 0 ? "Available" : "Unavailable",
      specialists: "Available",
      medicalEquipment: "Available",
      treatments: "Available",
      operationTheatres: "Available",
    },
    authorizedStaff: [creatorEmail.toLowerCase()],
  };

  // Persist locally
  const list = getLocalHospitals();
  const updated = [newHospital, ...list];
  saveLocalHospitals(updated);

  // Sync to Firestore in background if online (never blocks UI)
  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    withTimeout(setDoc(doc(db, FIRESTORE_COLLECTION, uniqueId), newHospital), 2500)
      .catch((err) => console.warn("Firestore registration save skipped (local persisted):", err.message));
  }

  return newHospital;
}

/**
 * Update Hospital Bed and Capacity Metrics.
 * Enforces capacity ceiling: available capacity cannot exceed configured capacity.
 * Stores updater email and timestamp.
 */
export async function updateHospitalCapacity(hospitalId, updates, updater) {
  const list = getLocalHospitals();
  const index = list.findIndex(h => h.id === hospitalId);
  if (index === -1) {
    throw new Error(`Hospital ${hospitalId} not found`);
  }

  const current = list[index];

  // Authorization check
  const staffEmail = (updater.email || "staff@hospital.med").toLowerCase();
  const isAuthorized = 
    !current.authorizedStaff || 
    current.authorizedStaff.length === 0 || 
    current.authorizedStaff.some(s => s.toLowerCase() === staffEmail) ||
    current.isDemoData; // Demo records are open to test updates

  if (!isAuthorized) {
    throw new Error(`Unauthorized: ${staffEmail} is not registered as authorized staff for ${current.name}.`);
  }

  // Sanitize capacity values
  const generalBedCapacity = current.generalBedCapacity || 50;
  const icuBedCapacity = current.icuBedCapacity || 10;
  const emergencyBedCapacity = current.emergencyFacilities?.bedCapacity || 10;

  let newAvailableBeds = updates.availableBeds !== undefined 
    ? parseInt(updates.availableBeds, 10) 
    : current.availableBeds;
  let newOccupiedBeds = updates.occupiedBeds !== undefined 
    ? parseInt(updates.occupiedBeds, 10) 
    : current.occupiedBeds;
  let newAvailableIcu = updates.availableIcuBeds !== undefined 
    ? parseInt(updates.availableIcuBeds, 10) 
    : (current.icuFacilities?.availableBeds ?? current.icuBedCapacity);
  let newAvailableEmergency = updates.availableEmergencyBeds !== undefined 
    ? parseInt(updates.availableEmergencyBeds, 10) 
    : current.availableEmergencyBeds;

  // Enforce Capacity Ceiling Rules:
  if (newAvailableBeds > generalBedCapacity) {
    throw new Error(`Available beds (${newAvailableBeds}) cannot exceed configured capacity (${generalBedCapacity}).`);
  }
  if (newOccupiedBeds > generalBedCapacity) {
    throw new Error(`Occupied beds (${newOccupiedBeds}) cannot exceed configured capacity (${generalBedCapacity}).`);
  }
  if (newAvailableIcu > icuBedCapacity) {
    throw new Error(`Available ICU beds (${newAvailableIcu}) cannot exceed ICU capacity (${icuBedCapacity}).`);
  }
  if (newAvailableEmergency > emergencyBedCapacity) {
    throw new Error(`Available emergency beds (${newAvailableEmergency}) cannot exceed emergency capacity (${emergencyBedCapacity}).`);
  }

  // Calculate coherent occupied beds if not specified
  if (updates.availableBeds !== undefined && updates.occupiedBeds === undefined) {
    newOccupiedBeds = Math.max(0, generalBedCapacity - newAvailableBeds);
  }

  const clampedAvailableBeds = Math.max(0, newAvailableBeds);
  const clampedOccupiedBeds = Math.max(0, newOccupiedBeds);
  const clampedAvailableIcu = Math.max(0, newAvailableIcu);
  const clampedAvailableEmergency = Math.max(0, newAvailableEmergency);
  const nowIso = new Date().toISOString();

  // Keep resourceStatus synchronized with actual numeric capacities
  const syncedResourceStatus = {
    ...(current.resourceStatus || {}),
    generalBeds: clampedAvailableBeds <= 0 ? "Unavailable" : clampedAvailableBeds <= 3 ? "Limited availability" : "Available",
    icuBeds: clampedAvailableIcu <= 0 ? "Unavailable" : clampedAvailableIcu <= 2 ? "Limited availability" : "Available",
    emergencyBeds: clampedAvailableEmergency <= 0 ? "Unavailable" : clampedAvailableEmergency <= 2 ? "Limited availability" : "Available",
  };

  const historyEntry = {
    timestamp: nowIso,
    by: updater.name || updater.email || "Hospital Staff",
    byEmail: staffEmail,
    action: updates.historyNote || "Capacity telemetry updated",
    availableBeds: clampedAvailableBeds,
    availableIcuBeds: clampedAvailableIcu,
    availableEmergencyBeds: clampedAvailableEmergency,
  };

  const updatedRecord = {
    ...current,
    availableBeds: clampedAvailableBeds,
    occupiedBeds: clampedOccupiedBeds,
    availableEmergencyBeds: clampedAvailableEmergency,
    emergencyFacilities: {
      ...current.emergencyFacilities,
      availableBeds: clampedAvailableEmergency
    },
    icuFacilities: {
      ...current.icuFacilities,
      availableBeds: clampedAvailableIcu
    },
    resourceStatus: syncedResourceStatus,
    activeReferrals: updates.activeReferrals !== undefined ? Math.max(0, parseInt(updates.activeReferrals, 10)) : current.activeReferrals,
    acceptedReferrals: updates.acceptedReferrals !== undefined ? Math.max(0, parseInt(updates.acceptedReferrals, 10)) : current.acceptedReferrals,
    rejectedReferrals: updates.rejectedReferrals !== undefined ? Math.max(0, parseInt(updates.rejectedReferrals, 10)) : current.rejectedReferrals,
    confirmedByHospital: true, // Confirmed directly by authorized staff
    lastUpdatedBy: updater.name || updater.email || "Hospital Staff",
    lastUpdatedByEmail: staffEmail,
    lastUpdatedAt: nowIso,
    availabilityHistory: [historyEntry, ...(current.availabilityHistory || [])].slice(0, 25),
  };

  list[index] = updatedRecord;
  saveLocalHospitals(list);

  // Background sync to Firestore if online
  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    withTimeout(
      updateDoc(doc(db, FIRESTORE_COLLECTION, hospitalId), {
        availableBeds: updatedRecord.availableBeds,
        occupiedBeds: updatedRecord.occupiedBeds,
        availableEmergencyBeds: updatedRecord.availableEmergencyBeds,
        emergencyFacilities: updatedRecord.emergencyFacilities,
        icuFacilities: updatedRecord.icuFacilities,
        resourceStatus: updatedRecord.resourceStatus,
        activeReferrals: updatedRecord.activeReferrals,
        acceptedReferrals: updatedRecord.acceptedReferrals,
        rejectedReferrals: updatedRecord.rejectedReferrals,
        confirmedByHospital: true,
        lastUpdatedBy: updatedRecord.lastUpdatedBy,
        lastUpdatedByEmail: updatedRecord.lastUpdatedByEmail,
        lastUpdatedAt: updatedRecord.lastUpdatedAt,
        availabilityHistory: updatedRecord.availabilityHistory
      }),
      2500
    ).catch(err => console.warn("Firestore update skipped (local persisted):", err.message));
  }

  return updatedRecord;
}

/**
 * Update Resource Management Status.
 * Allowed statuses: "Available" | "Limited availability" | "Unavailable" | "Awaiting verification"
 */
export async function updateResourceStatus(hospitalId, resourceKey, status, updater) {
  const allowed = ["Available", "Limited availability", "Unavailable", "Awaiting verification"];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid resource status: ${status}. Must be one of ${allowed.join(", ")}`);
  }

  const list = getLocalHospitals();
  const index = list.findIndex(h => h.id === hospitalId);
  if (index === -1) {
    throw new Error(`Hospital ${hospitalId} not found`);
  }

  const current = list[index];
  const staffEmail = (updater.email || "staff@hospital.med").toLowerCase();
  const nowIso = new Date().toISOString();

  const newResourceStatus = {
    ...(current.resourceStatus || {}),
    [resourceKey]: status
  };

  const historyEntry = {
    timestamp: nowIso,
    by: updater.name || updater.email || "Hospital Staff",
    byEmail: staffEmail,
    action: `Resource '${resourceKey}' set to '${status}'`,
    availableBeds: current.availableBeds,
    availableIcuBeds: current.icuFacilities?.availableBeds ?? 0,
    availableEmergencyBeds: current.availableEmergencyBeds,
  };

  const updatedRecord = {
    ...current,
    resourceStatus: newResourceStatus,
    confirmedByHospital: status !== "Awaiting verification",
    lastUpdatedBy: updater.name || updater.email || "Hospital Staff",
    lastUpdatedByEmail: staffEmail,
    lastUpdatedAt: nowIso,
    availabilityHistory: [historyEntry, ...(current.availabilityHistory || [])].slice(0, 25),
  };

  list[index] = updatedRecord;
  saveLocalHospitals(list);

  // Background sync to Firestore if online
  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    withTimeout(
      updateDoc(doc(db, FIRESTORE_COLLECTION, hospitalId), {
        resourceStatus: newResourceStatus,
        confirmedByHospital: updatedRecord.confirmedByHospital,
        lastUpdatedBy: updatedRecord.lastUpdatedBy,
        lastUpdatedByEmail: updatedRecord.lastUpdatedByEmail,
        lastUpdatedAt: updatedRecord.lastUpdatedAt,
        availabilityHistory: updatedRecord.availabilityHistory
      }),
      2500
    ).catch(err => console.warn("Firestore resource status update skipped:", err.message));
  }

  return updatedRecord;
}

/**
 * Authorize staff email to manage a hospital
 */
export async function claimHospitalStaff(hospitalId, staffEmail) {
  const list = getLocalHospitals();
  const index = list.findIndex(h => h.id === hospitalId);
  if (index === -1) throw new Error("Hospital not found");

  const current = list[index];
  const staff = current.authorizedStaff || [];
  if (!staff.map(s => s.toLowerCase()).includes(staffEmail.toLowerCase())) {
    current.authorizedStaff = [...staff, staffEmail.toLowerCase()];
    list[index] = current;
    saveLocalHospitals(list);
  }
  return current;
}

/**
 * Atomically reserve a capacity hold when an authorized staff member accepts a referral.
 * Prevents conflicting capacity reservations (double holds or reserving when capacity is 0).
 */
export async function reserveHospitalCapacityHold(hospitalId, {
  referralId,
  icuRequired = false,
  emergencyRequired = false,
  staffName = "Hospital Staff",
  staffEmail = "staff@hospital.med",
  durationMinutes = 120,
}) {
  const list = getLocalHospitals();
  const index = list.findIndex((h) => h.id === hospitalId);
  if (index === -1) throw new Error(`Hospital ${hospitalId} not found.`);

  const current = list[index];
  const existingHolds = Array.isArray(current.activeHolds) ? current.activeHolds : [];

  // Conflict check: prevent double reservation for same referral
  if (existingHolds.some((h) => h.referralId === referralId && h.status === "Active")) {
    throw new Error(`Capacity hold conflict: Referral ${referralId} already has an active bed reservation at ${current.name}.`);
  }

  if ((current.availableBeds || 0) <= 0) {
    throw new Error(`Capacity conflict: ${current.name} has 0 available general beds to hold.`);
  }

  const openIcu = current.icuFacilities?.availableBeds ?? 0;
  if (icuRequired && openIcu <= 0) {
    throw new Error(`Capacity conflict: ${current.name} has 0 open ICU beds to hold.`);
  }

  const openEmerg = current.availableEmergencyBeds ?? 0;
  if (emergencyRequired && openEmerg <= 0) {
    throw new Error(`Capacity conflict: ${current.name} has 0 open Emergency bays to hold.`);
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + durationMinutes * 60 * 1000).toISOString();
  const holdId = `HOLD-${now.toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const holdRecord = {
    holdId,
    referralId,
    hospitalId,
    icuReserved: Boolean(icuRequired),
    emergencyBayReserved: Boolean(emergencyRequired),
    status: "Active",
    heldAt: nowIso,
    expiresAt,
    heldBy: staffEmail.toLowerCase(),
    heldByName: staffName,
  };

  const nextAvailableBeds = Math.max(0, (current.availableBeds || 0) - 1);
  const nextOccupiedBeds = Math.min(current.generalBedCapacity || 9999, (current.occupiedBeds || 0) + 1);
  const nextAvailableIcu = icuRequired ? Math.max(0, openIcu - 1) : openIcu;
  const nextAvailableEmergency = emergencyRequired ? Math.max(0, openEmerg - 1) : openEmerg;

  const updated = {
    ...current,
    availableBeds: nextAvailableBeds,
    occupiedBeds: nextOccupiedBeds,
    availableEmergencyBeds: nextAvailableEmergency,
    emergencyFacilities: {
      ...current.emergencyFacilities,
      availableBeds: nextAvailableEmergency,
    },
    icuFacilities: {
      ...current.icuFacilities,
      availableBeds: nextAvailableIcu,
    },
    resourceStatus: {
      ...(current.resourceStatus || {}),
      generalBeds: nextAvailableBeds <= 0 ? "Unavailable" : nextAvailableBeds <= 3 ? "Limited availability" : "Available",
      icuBeds: nextAvailableIcu <= 0 ? "Unavailable" : nextAvailableIcu <= 2 ? "Limited availability" : "Available",
      emergencyBeds: nextAvailableEmergency <= 0 ? "Unavailable" : nextAvailableEmergency <= 2 ? "Limited availability" : "Available",
    },
    activeHolds: [...existingHolds, holdRecord],
    lastUpdatedBy: staffName,
    lastUpdatedByEmail: staffEmail.toLowerCase(),
    lastUpdatedAt: nowIso,
    availabilityHistory: [
      {
        timestamp: nowIso,
        by: staffName,
        byEmail: staffEmail.toLowerCase(),
        action: `Bed reserved (${holdId}) for referral ${referralId}`,
        availableBeds: nextAvailableBeds,
        availableIcuBeds: nextAvailableIcu,
        availableEmergencyBeds: nextAvailableEmergency,
      },
      ...(current.availabilityHistory || []),
    ].slice(0, 25),
  };

  list[index] = updated;
  saveLocalHospitals(list);

  // Transactional Firestore update when online
  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    withTimeout(
      runTransaction(db, async (tx) => {
        const ref = doc(db, FIRESTORE_COLLECTION, hospitalId);
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          tx.set(ref, updated);
          return;
        }
        tx.update(ref, {
          availableBeds: updated.availableBeds,
          occupiedBeds: updated.occupiedBeds,
          availableEmergencyBeds: updated.availableEmergencyBeds,
          emergencyFacilities: updated.emergencyFacilities,
          icuFacilities: updated.icuFacilities,
          resourceStatus: updated.resourceStatus,
          activeHolds: updated.activeHolds,
          lastUpdatedBy: updated.lastUpdatedBy,
          lastUpdatedByEmail: updated.lastUpdatedByEmail,
          lastUpdatedAt: updated.lastUpdatedAt,
          availabilityHistory: updated.availabilityHistory,
        });
      }),
      2500
    ).catch((err) => console.warn("Firestore capacity hold transaction skipped (local persisted):", err.message));
  }

  return { hospital: updated, hold: holdRecord };
}

/**
 * Safely release a capacity hold when expired or cancelled, restoring bed counts up to configured ceiling.
 */
export async function releaseHospitalCapacityHold(hospitalId, {
  referralId,
  reason = "Cancelled", // "Cancelled" | "Expired" | "Redirected"
  actorName = "System Capacity Guard",
  actorEmail = "system@relieflaser.med",
  icuReservedFallback = false,
  emergencyReservedFallback = false,
}) {
  const list = getLocalHospitals();
  const index = list.findIndex((h) => h.id === hospitalId);
  if (index === -1) return null;

  const current = list[index];
  const holds = Array.isArray(current.activeHolds) ? current.activeHolds : [];
  const targetHold = holds.find((h) => h.referralId === referralId && h.status === "Active");
  if (!targetHold) {
    return null; // Already released or never held
  }

  const nowIso = new Date().toISOString();
  const newHoldStatus = reason === "Expired" ? "Expired" : "Released";

  const icuToRestore = targetHold.icuReserved || icuReservedFallback ? 1 : 0;
  const emergToRestore = targetHold.emergencyBayReserved || emergencyReservedFallback ? 1 : 0;

  const genCap = current.generalBedCapacity || 100;
  const icuCap = current.icuFacilities?.bedCapacity ?? current.icuBedCapacity ?? 20;
  const emergCap = current.emergencyFacilities?.bedCapacity ?? 15;

  const nextAvailableBeds = Math.min(genCap, (current.availableBeds || 0) + 1);
  const nextOccupiedBeds = Math.max(0, (current.occupiedBeds || 0) - 1);
  const currentOpenIcu = current.icuFacilities?.availableBeds ?? 0;
  const nextAvailableIcu = Math.min(icuCap, currentOpenIcu + icuToRestore);
  const nextAvailableEmergency = Math.min(emergCap, (current.availableEmergencyBeds || 0) + emergToRestore);

  const updatedHolds = holds.map((h) =>
    h.holdId === targetHold.holdId
      ? { ...h, status: newHoldStatus, releasedAt: nowIso, releaseReason: reason, releasedBy: actorEmail }
      : h
  );

  const updated = {
    ...current,
    availableBeds: nextAvailableBeds,
    occupiedBeds: nextOccupiedBeds,
    availableEmergencyBeds: nextAvailableEmergency,
    emergencyFacilities: {
      ...current.emergencyFacilities,
      availableBeds: nextAvailableEmergency,
    },
    icuFacilities: {
      ...current.icuFacilities,
      availableBeds: nextAvailableIcu,
    },
    resourceStatus: {
      ...(current.resourceStatus || {}),
      generalBeds: nextAvailableBeds <= 0 ? "Unavailable" : nextAvailableBeds <= 3 ? "Limited availability" : "Available",
      icuBeds: nextAvailableIcu <= 0 ? "Unavailable" : nextAvailableIcu <= 2 ? "Limited availability" : "Available",
      emergencyBeds: nextAvailableEmergency <= 0 ? "Unavailable" : nextAvailableEmergency <= 2 ? "Limited availability" : "Available",
    },
    activeHolds: updatedHolds,
    lastUpdatedBy: actorName,
    lastUpdatedByEmail: actorEmail,
    lastUpdatedAt: nowIso,
    availabilityHistory: [
      {
        timestamp: nowIso,
        by: actorName,
        byEmail: actorEmail,
        action: `Bed hold ${newHoldStatus} (${reason}) for referral ${referralId}`,
        availableBeds: nextAvailableBeds,
        availableIcuBeds: nextAvailableIcu,
        availableEmergencyBeds: nextAvailableEmergency,
      },
      ...(current.availabilityHistory || []),
    ].slice(0, 25),
  };

  list[index] = updated;
  saveLocalHospitals(list);

  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    withTimeout(
      runTransaction(db, async (tx) => {
        const ref = doc(db, FIRESTORE_COLLECTION, hospitalId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        tx.update(ref, {
          availableBeds: updated.availableBeds,
          occupiedBeds: updated.occupiedBeds,
          availableEmergencyBeds: updated.availableEmergencyBeds,
          emergencyFacilities: updated.emergencyFacilities,
          icuFacilities: updated.icuFacilities,
          resourceStatus: updated.resourceStatus,
          activeHolds: updated.activeHolds,
          lastUpdatedBy: updated.lastUpdatedBy,
          lastUpdatedByEmail: updated.lastUpdatedByEmail,
          lastUpdatedAt: updated.lastUpdatedAt,
          availabilityHistory: updated.availabilityHistory,
        });
      }),
      2500
    ).catch((err) => console.warn("Firestore capacity release transaction skipped:", err.message));
  }

  return { hospital: updated, releasedHold: updatedHolds.find((h) => h.holdId === targetHold.holdId) };
}

/**
 * Subscribe to real-time hospital capacity & directory updates.
 * Unifies Firestore onSnapshot (if online), local CustomEvents, and cross-tab storage events.
 */
export function subscribeToHospitals(callback) {
  const onCustom = (e) => {
    if (Array.isArray(e.detail)) callback(e.detail);
    else callback(getLocalHospitals());
  };

  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) callback(getLocalHospitals());
  };

  if (typeof window !== "undefined") {
    window.addEventListener("relief_hospitals_updated", onCustom);
    window.addEventListener("storage", onStorage);
  }

  let unsubFirestore = null;
  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, FIRESTORE_COLLECTION),
        (snap) => {
          if (!snap.empty) {
            const cloudList = [];
            snap.forEach((d) => cloudList.push({ id: d.id, ...d.data() }));
            saveLocalHospitals(cloudList);
            callback(cloudList);
          }
        },
        () => {} // Ignore snapshot permission/offline warnings gracefully
      );
    } catch {
      // Ignore if Firestore offline
    }
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("relief_hospitals_updated", onCustom);
      window.removeEventListener("storage", onStorage);
    }
    if (typeof unsubFirestore === "function") unsubFirestore();
  };
}

const ADMIN_AUDIT_STORAGE_KEY = "relief_laser_health_admin_audit_v1";

/**
 * Retrieve persistent Super Admin audit log (most recent first).
 */
export function getAdminAuditLogs() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(ADMIN_AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function appendAdminAuditLog(entry) {
  const logs = getAdminAuditLogs();
  const nextEntry = {
    id: `AUD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const updated = [nextEntry, ...logs].slice(0, 100);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(ADMIN_AUDIT_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore storage quota warnings
  }
  return nextEntry;
}

/**
 * Super Admin Action: Approve, Reject, Suspend, or Reactivate a hospital account.
 * Records complete verification metadata and appends an immutable audit log entry.
 */
export async function verifyHospitalByAdmin(hospitalId, { decision, adminName, adminEmail, notes }) {
  const allowedDecisions = ["Verified", "Rejected", "Suspended", "Pending Verification"];
  if (!allowedDecisions.includes(decision)) {
    throw new Error(`Invalid admin verification decision "${decision}".`);
  }

  const list = getLocalHospitals();
  const idx = list.findIndex((h) => h.id === hospitalId);
  if (idx === -1) {
    throw new Error(`Hospital ${hospitalId} not found`);
  }

  const current = list[idx];
  const nowIso = new Date().toISOString();
  const prevStatus = current.verificationStatus || (current.isDemoData ? "Verified" : "Pending Verification");

  const updated = {
    ...current,
    verificationStatus: decision,
    verifiedAt: decision === "Verified" ? nowIso : current.verifiedAt || null,
    verifiedBy: adminEmail || adminName || "Super Admin",
    verificationNotes: (notes || "").trim() || current.verificationNotes || "",
    suspendedAt: decision === "Suspended" ? nowIso : null,
    suspendedReason: decision === "Suspended" ? (notes || "Suspended by platform administrator") : null,
    lastUpdatedBy: adminName || "Platform Super Admin",
    lastUpdatedByEmail: adminEmail || "superadmin@relieflaser.health",
    lastUpdatedAt: nowIso,
    availabilityHistory: [
      {
        timestamp: nowIso,
        by: adminName || "Super Admin",
        byEmail: adminEmail || "superadmin@relieflaser.health",
        action: `Admin decision: ${prevStatus} → ${decision}${notes ? ` (${notes})` : ""}`,
        availableBeds: current.availableBeds,
        availableIcuBeds: current.icuFacilities?.availableBeds ?? 0,
        availableEmergencyBeds: current.availableEmergencyBeds,
      },
      ...(current.availabilityHistory || []),
    ].slice(0, 25),
  };

  list[idx] = updated;
  saveLocalHospitals(list);

  appendAdminAuditLog({
    actionType: `HOSPITAL_${decision.toUpperCase().replace(/\s+/g, "_")}`,
    targetType: "hospital",
    targetId: hospitalId,
    targetName: current.name,
    actorName: adminName || "Super Admin",
    actorEmail: adminEmail || "superadmin@relieflaser.health",
    previousStatus: prevStatus,
    newStatus: decision,
    notes: notes || `Changed verification standing from ${prevStatus} to ${decision}`,
  });

  if (db && typeof window !== "undefined" && window.navigator?.onLine !== false) {
    withTimeout(
      updateDoc(doc(db, FIRESTORE_COLLECTION, hospitalId), {
        verificationStatus: updated.verificationStatus,
        verifiedAt: updated.verifiedAt,
        verifiedBy: updated.verifiedBy,
        verificationNotes: updated.verificationNotes,
        suspendedAt: updated.suspendedAt,
        suspendedReason: updated.suspendedReason,
        lastUpdatedAt: updated.lastUpdatedAt,
        availabilityHistory: updated.availabilityHistory,
      }),
      2500
    ).catch((err) => console.warn("Firestore admin update skipped (local persisted):", err.message));
  }

  return updated;
}
