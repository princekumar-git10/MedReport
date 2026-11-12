/**
 * Smart Hospital Matching Engine for Relief Laser Health
 * 
 * Core matching logic:
 * Step 1: Read referral clinical requirements & preferences
 * Step 2: Retrieve registered hospitals
 * Step 3: Apply mandatory hard eligibility filters (clinical capability, equipment, specialist, capacity, timeframe)
 * Step 4: Exclude unsuitable hospitals from eligible pool
 * Step 5: Rank eligible hospitals using a configurable weighted ranking system:
 *         - Clinical capability match (30%)
 *         - Verified capacity (25%)
 *         - Distance & estimated travel time (20%)
 *         - Referral response performance (15%)
 *         - Insurance compatibility (10%)
 */

// Default ranking weights (Configurable)
export const DEFAULT_RANKING_WEIGHTS = {
  clinicalMatch: 0.30,
  verifiedCapacity: 0.25,
  proximityAndTravelTime: 0.20,
  responsePerformance: 0.15,
  insuranceCompatibility: 0.10,
};

// Major Indian metropolitan coordinates for distance estimation when exact GPS is not provided
const CITY_COORDINATES = {
  "new delhi": { lat: 28.6139, lng: 77.2090 },
  "delhi": { lat: 28.6139, lng: 77.2090 },
  "delhi ncr": { lat: 28.6139, lng: 77.2090 },
  "noida": { lat: 28.5355, lng: 77.3910 },
  "gurugram": { lat: 28.4595, lng: 77.0266 },
  "mumbai": { lat: 19.0760, lng: 72.8777 },
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "hyderabad": { lat: 17.3850, lng: 78.4867 },
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "kolkata": { lat: 22.5726, lng: 88.3639 },
  "pune": { lat: 18.5204, lng: 73.8567 },
  "ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "jaipur": { lat: 26.9124, lng: 75.7873 },
  "chandigarh": { lat: 30.7333, lng: 76.7794 },
};

/**
 * Calculate geographical distance using the Haversine formula in Kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 18; // Default plausible urban distance in km

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimate travel time in urban traffic based on distance (km) and urgency
 */
export function estimateTravelTime(distanceKm, priority = "Routine") {
  // Speed model: Emergency with ambulance green-corridor ~ 45 km/h, Routine ~ 25 km/h in metro traffic
  const speed = priority === "Emergency" ? 45 : 25;
  const minutes = Math.max(8, Math.round((distanceKm / speed) * 60) + 5); // +5 min dispatch buffer
  if (minutes < 60) {
    return `${minutes} mins`;
  }
  const hrs = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return `${hrs}h ${remMins}m`;
}

/**
 * STEP 3 & 4: MANDATORY HARD ELIGIBILITY FILTERS
 * 
 * Clinical eligibility is a HARD filter, not a weighted preference.
 * A hospital MUST satisfy:
 * 1. Required treatment is supported.
 * 2. Required medical department exists.
 * 3. Required equipment is available and functional.
 * 4. Appropriate specialist coverage is available.
 * 5. Required ICU or bed capacity is reported available.
 * 6. Hospital can accept the referral within the required timeframe (Emergency/Urgent operational capacity).
 * 
 * Returns eligibility assessment object.
 */
export function evaluateEligibility(hospital, requirements = {}, priority = "Routine") {
  const missingCriteria = [];
  const passedCriteria = [];

  // 0. Platform Standing & Suspension Guard
  const standing = hospital.verificationStatus || (hospital.isDemoData ? "Verified" : "Pending Verification");
  if (standing === "Suspended" || standing === "Rejected") {
    missingCriteria.push(`Hospital account standing is '${standing}' and suspended from receiving referrals`);
  } else if (standing === "Verified") {
    passedCriteria.push("Platform Standing: Verified Hospital");
  } else {
    passedCriteria.push("Platform Standing: Pending Admin Verification");
  }

  const targetSpecialty = (requirements.specialty || "").trim().toLowerCase();
  const targetProc = (requirements.procedure || "").trim().toLowerCase();
  const equipReq = (requirements.equipmentRequirements || "").trim().toLowerCase();
  const specReq = (requirements.requiredSpecialist || "").trim().toLowerCase();

  // 1. Mandatory Treatment Support
  const treatments = (hospital.availableTreatments || []).map((t) => t.toLowerCase());
  const matchesTreatment = 
    !targetProc || 
    treatments.some((t) => t.includes(targetProc) || targetProc.includes(t)) ||
    treatments.some((t) => {
      // Fuzzy keywords matching
      const words = targetProc.split(/\s+/).filter(w => w.length > 3);
      return words.some(w => t.includes(w));
    });

  if (!matchesTreatment) {
    missingCriteria.push(`Required treatment/procedure ("${requirements.procedure}") is not supported at this facility`);
  } else {
    passedCriteria.push(`Supported Treatment: ${requirements.procedure}`);
  }

  // 2. Mandatory Medical Department Existence
  const departments = (hospital.departments || []).map((d) => d.toLowerCase());
  const matchesDept = 
    !targetSpecialty ||
    departments.some((d) => d.includes(targetSpecialty) || targetSpecialty.includes(d)) ||
    departments.some((d) => {
      const words = targetSpecialty.split(/\s+/).filter(w => w.length > 3);
      return words.some(w => d.includes(w));
    });

  if (!matchesDept) {
    missingCriteria.push(`Medical department ("${requirements.specialty}") is not established at this hospital`);
  } else {
    passedCriteria.push(`Specialty Department: ${requirements.specialty}`);
  }

  // 3. Mandatory Equipment Availability & Functionality
  const resourceStatus = hospital.resourceStatus || {};
  if (resourceStatus.medicalEquipment === "Unavailable") {
    missingCriteria.push("Medical equipment / surgical lasers are reported currently UNAVAILABLE or under maintenance");
  } else if (equipReq) {
    const hospEquip = (hospital.medicalEquipment || []).map((e) => e.toLowerCase());
    const equipParts = equipReq.split(/[,&/]| and /).map((w) => w.trim().toLowerCase()).filter((w) => w.length > 3);
    const matchesEquip = hospEquip.some((e) => {
      if (e.includes(equipReq) || equipReq.includes(e)) return true;
      return equipParts.some((part) => {
        if (e.includes(part) || part.includes(e)) return true;
        // Check core technology keywords (holmium, diode, thulium, laparoscopic, c-arm, co2, excimer, nd:yag, etc.)
        const techKeywords = part.split(/\s+/).filter((k) => k.length > 4);
        return techKeywords.some((k) => e.includes(k));
      });
    });
    if (matchesEquip) {
      passedCriteria.push("Specific Medical Equipment Verified Operational");
    } else {
      // If specific rare laser is required but missing
      if (equipReq.includes("thulium") || equipReq.includes("holmium") || equipReq.includes("robotic")) {
        missingCriteria.push(`Specialized laser/robotic unit ("${requirements.equipmentRequirements}") not installed`);
      } else {
        passedCriteria.push("Standard Surgical Laser Equipment Available");
      }
    }
  } else {
    passedCriteria.push("Medical Equipment Available");
  }

  // 4. Mandatory Specialist Coverage
  if (resourceStatus.specialists === "Unavailable") {
    missingCriteria.push("Specialist surgeons in this department are currently reported UNAVAILABLE");
  } else {
    passedCriteria.push("Specialist Coverage Active");
  }

  // 5. Mandatory Bed & ICU Capacity
  // General bed check
  if (hospital.availableBeds <= 0 || resourceStatus.generalBeds === "Unavailable") {
    missingCriteria.push("Zero general beds available for admission (Hospital at 100% occupancy)");
  } else {
    passedCriteria.push(`General Beds Available: ${hospital.availableBeds} beds open`);
  }

  // ICU capacity check (if required)
  if (requirements.icuRequired) {
    const openIcu = hospital.icuFacilities?.availableBeds ?? hospital.icuBedCapacity ?? 0;
    if (openIcu <= 0 || resourceStatus.icuBeds === "Unavailable" || !hospital.icuFacilities?.available) {
      missingCriteria.push("ICU is at full capacity with 0 critical care ventilator beds open");
    } else {
      passedCriteria.push(`ICU Capacity Verified: ${openIcu} critical care beds open`);
    }
  }

  // Emergency capacity check (if required)
  if (requirements.emergencySupportRequired) {
    const openEmerg = hospital.availableEmergencyBeds ?? hospital.emergencyFacilities?.availableBeds ?? 0;
    if (openEmerg <= 0 || resourceStatus.emergencyBeds === "Unavailable" || !hospital.emergencyFacilities?.available) {
      missingCriteria.push("24/7 Emergency trauma bay is currently occupied / unavailable");
    } else {
      passedCriteria.push(`Emergency Bay Verified: ${openEmerg} trauma beds open`);
    }
  }

  // 6. Timeframe & Urgency Operational Acceptance
  if (priority === "Emergency") {
    const isLevel1Emerg = hospital.emergencyFacilities?.available && (hospital.availableEmergencyBeds > 0);
    if (!isLevel1Emerg) {
      missingCriteria.push("Cannot accept Level-1 Emergency: Emergency admission receiving desk is closed or full");
    } else {
      passedCriteria.push("Level-1 Emergency Rapid Receiving Verified");
    }
  } else if (priority === "Urgent") {
    if (resourceStatus.operationTheatres === "Unavailable") {
      missingCriteria.push("Operation theatres unavailable for urgent scheduling within 24 hours");
    } else {
      passedCriteria.push("Urgent 24h OR Scheduling Verified");
    }
  }

  const isEligible = missingCriteria.length === 0;

  // Determine baseline status label
  let status = "Suitable";
  if (!isEligible) {
    // Distinguish between Not Suitable (missing clinical requirements) vs Unavailable (has department but 0 capacity)
    if (hospital.availableBeds <= 0 || resourceStatus.generalBeds === "Unavailable" || resourceStatus.icuBeds === "Unavailable") {
      status = "Unavailable";
    } else {
      status = "Not suitable";
    }
  } else if (!hospital.confirmedByHospital || resourceStatus.treatments === "Awaiting verification") {
    status = "Awaiting confirmation";
  }

  return {
    isEligible,
    status,
    missingCriteria,
    passedCriteria,
  };
}

/**
 * STEP 5: CONFIGURABLE WEIGHTED RANKING SYSTEM
 * 
 * Ranks eligible hospitals using:
 * 1. Clinical capability match (30%)
 * 2. Verified capacity (25%)
 * 3. Distance and estimated travel time (20%)
 * 4. Referral response performance (15%)
 * 5. Insurance compatibility (10%)
 */
export function calculateHospitalRank(hospital, referral, weights = DEFAULT_RANKING_WEIGHTS) {
  const req = referral.clinicalRequirements || {};
  const pref = referral.preferences || {};
  const patient = referral.patient || {};
  const priority = referral.priority || "Routine";

  // Score breakdown tracker
  const scoreBreakdown = {
    clinicalMatch: 0,
    verifiedCapacity: 0,
    proximityAndTravelTime: 0,
    responsePerformance: 0,
    insuranceCompatibility: 0,
  };

  // 1. Clinical Capability Match (0 to 100)
  let clinicalScore = 70;
  const targetProc = (req.procedure || "").toLowerCase();
  const targetSpecialty = (req.specialty || "").toLowerCase();

  const treatments = (hospital.availableTreatments || []).map((t) => t.toLowerCase());
  const depts = (hospital.departments || []).map((d) => d.toLowerCase());

  if (treatments.some((t) => t.includes(targetProc))) clinicalScore += 20;
  if (depts.some((d) => d.includes(targetSpecialty))) clinicalScore += 10;
  scoreBreakdown.clinicalMatch = Math.min(100, clinicalScore);

  // 2. Verified Capacity Score (0 to 100)
  let capacityScore = 50;
  const occupancyRate = hospital.generalBedCapacity > 0 
    ? ((hospital.generalBedCapacity - hospital.availableBeds) / hospital.generalBedCapacity) * 100
    : 100;

  // More open beds = higher score
  if (occupancyRate < 60) capacityScore += 30;
  else if (occupancyRate < 80) capacityScore += 20;
  else capacityScore += 10;

  // Staff-confirmed capacity bonus
  if (hospital.confirmedByHospital) {
    capacityScore += 20;
  }
  scoreBreakdown.verifiedCapacity = Math.min(100, capacityScore);

  // 3. Distance and Estimated Travel Time
  // Coordinate extraction
  const hospCoords = hospital.coordinates?.lat && hospital.coordinates?.lng 
    ? hospital.coordinates 
    : CITY_COORDINATES[(hospital.city || "").toLowerCase()] || { lat: 28.6139, lng: 77.2090 };

  const patientCity = (pref.preferredLocation || patient.location || "").toLowerCase();
  const patientCoords = CITY_COORDINATES[patientCity] || { lat: 28.6139, lng: 77.2090 };

  const distanceKm = calculateDistanceKm(
    patientCoords.lat,
    patientCoords.lng,
    hospCoords.lat,
    hospCoords.lng
  );
  const travelTime = estimateTravelTime(distanceKm, priority);

  let proximityScore = 100;
  if (distanceKm > 50) proximityScore = 30;
  else if (distanceKm > 25) proximityScore = 60;
  else if (distanceKm > 10) proximityScore = 80;
  else proximityScore = 100;

  scoreBreakdown.proximityAndTravelTime = proximityScore;

  // 4. Referral Response Performance (0 to 100)
  // Metrics: confirmation rate, accepted ratio, historical response time
  let responseScore = 75;
  if (hospital.acceptedReferrals && hospital.acceptedReferrals > 10) {
    responseScore += 15;
  }
  if (hospital.rejectedReferrals === 0) {
    responseScore += 10;
  }
  scoreBreakdown.responsePerformance = Math.min(100, responseScore);

  // 5. Insurance Compatibility (0 to 100)
  let insuranceScore = 80; // Standard baseline
  const reqIns = (pref.insuranceRequirements || "").toLowerCase();
  if (reqIns.includes("cashless") || reqIns.includes("tpa")) {
    insuranceScore = 95; // Accredited partner network centers support cashless TPA
  } else if (reqIns.includes("ayushman") || reqIns.includes("pmjay")) {
    insuranceScore = hospital.hospitalType?.includes("General") || hospital.hospitalType?.includes("Academic") ? 100 : 70;
  }
  scoreBreakdown.insuranceCompatibility = insuranceScore;

  // Weighted Total Calculation
  const totalScore = Math.round(
    scoreBreakdown.clinicalMatch * weights.clinicalMatch +
    scoreBreakdown.verifiedCapacity * weights.verifiedCapacity +
    scoreBreakdown.proximityAndTravelTime * weights.proximityAndTravelTime +
    scoreBreakdown.responsePerformance * weights.responsePerformance +
    scoreBreakdown.insuranceCompatibility * weights.insuranceCompatibility
  );

  return {
    rankScore: Math.min(100, Math.max(0, totalScore)),
    distanceKm,
    travelTime,
    scoreBreakdown,
  };
}

/**
 * MAIN MATCHING ENGINE RUNNER
 * 
 * Takes a referral object and an array of hospitals.
 * Evaluates mandatory eligibility, separates unsuitable candidates,
 * ranks eligible candidates, and formats explanation tags.
 */
export function runMatchingEngine(referral, hospitals = [], options = {}) {
  const weights = { ...DEFAULT_RANKING_WEIGHTS, ...(options.weights || {}) };
  const targetHospitalId = referral.targetHospitalId;

  const eligibleList = [];
  const unsuitableList = [];

  for (const hosp of hospitals) {
    // Step 3: Hard Eligibility Evaluation
    const evalResult = evaluateEligibility(
      hosp, 
      referral.clinicalRequirements, 
      referral.priority
    );

    // Step 5: Rank & Calculate Metrics
    const rankResult = calculateHospitalRank(hosp, referral, weights);

    // Status assignment
    let finalStatus = evalResult.status;
    if (targetHospitalId === hosp.id) {
      if (referral.status === "Accepted") {
        finalStatus = "Accepted";
      } else if (referral.status === "Pending") {
        finalStatus = "Awaiting confirmation";
      }
    }

    const hospitalCardData = {
      hospital: {
        id: hosp.id,
        name: hosp.name,
        address: hosp.address,
        city: hosp.city,
        state: hosp.state,
        pincode: hosp.pincode,
        contactPhone: hosp.contactPhone,
        email: hosp.email,
        hospitalType: hosp.hospitalType,
        departments: hosp.departments || [],
        availableTreatments: hosp.availableTreatments || [],
        medicalEquipment: hosp.medicalEquipment || [],
        generalBedCapacity: hosp.generalBedCapacity,
        availableBeds: hosp.availableBeds,
        occupiedBeds: hosp.occupiedBeds,
        icuBedCapacity: hosp.icuBedCapacity,
        availableEmergencyBeds: hosp.availableEmergencyBeds,
        confirmedByHospital: hosp.confirmedByHospital,
        lastUpdatedAt: hosp.lastUpdatedAt,
        lastUpdatedBy: hosp.lastUpdatedBy,
        sourceNote: hosp.sourceNote || "Accredited Hospital Network",
        isDemoData: Boolean(hosp.isDemoData),
      },
      status: finalStatus,
      isEligible: evalResult.isEligible,
      matchScore: evalResult.isEligible ? rankResult.rankScore : 0,
      distanceKm: rankResult.distanceKm,
      travelTime: rankResult.travelTime,
      passedCriteria: evalResult.passedCriteria,
      missingCriteria: evalResult.missingCriteria,
      scoreBreakdown: rankResult.scoreBreakdown,
      explanation: evalResult.isEligible
        ? `Ranked ${rankResult.rankScore}% based on clinical specialty alignment (${rankResult.scoreBreakdown.clinicalMatch}%), verified bed telemetry (${rankResult.scoreBreakdown.verifiedCapacity}%), and proximity (${rankResult.distanceKm} km, ~${rankResult.travelTime}).`
        : `Excluded from referral consideration: ${evalResult.missingCriteria.join("; ")}.`,
    };

    if (evalResult.isEligible) {
      eligibleList.push(hospitalCardData);
    } else {
      unsuitableList.push(hospitalCardData);
    }
  }

  // Sort eligible hospitals by matchScore descending, then by distance ascending
  eligibleList.sort((a, b) => b.matchScore - a.matchScore || a.distanceKm - b.distanceKm);

  return {
    evaluatedAt: new Date().toISOString(),
    referralId: referral.id,
    patientName: referral.patient?.name,
    priority: referral.priority,
    totalEvaluated: hospitals.length,
    eligibleCount: eligibleList.length,
    unsuitableCount: unsuitableList.length,
    eligibleHospitals: eligibleList,
    unsuitableHospitals: unsuitableList,
    emergencyEscalationNeeded: referral.priority === "Emergency",
  };
}

