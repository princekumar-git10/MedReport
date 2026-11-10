import React, { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n.js";
import { TRANSLATIONS, TEST_NAME_TRANSLATIONS } from "../locales/translations.js";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", voiceLang: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिंदी", voiceLang: "hi-IN" },
  { code: "bn", label: "Bengali", native: "বাংলা", voiceLang: "bn-IN" },
  { code: "ta", label: "Tamil", native: "தமிழ்", voiceLang: "ta-IN" },
  { code: "te", label: "Telugu", native: "తెలుగు", voiceLang: "te-IN" },
  { code: "mr", label: "Marathi", native: "मराठी", voiceLang: "mr-IN" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", voiceLang: "gu-IN" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", voiceLang: "kn-IN" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", voiceLang: "ml-IN" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", voiceLang: "pa-IN" },
];

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { t: i18nT, i18n: i18nInstance } = useTranslation();

  const [lang, setLangState] = useState(() => {
    return localStorage.getItem("medreport_language") || "en";
  });

  const setLang = (newLang) => {
    setLangState(newLang);
    try {
      localStorage.setItem("medreport_language", newLang);
      document.documentElement.lang = newLang;
      i18nInstance.changeLanguage(newLang);
    } catch (e) {
      console.warn("Could not save language to localStorage:", e);
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    if (i18nInstance.language !== lang) {
      i18nInstance.changeLanguage(lang);
    }
  }, [lang]);

  /**
   * Safe Dot-Notation Translation Lookup with Variable Interpolation
   * Bridges our existing t("section.key", { param }) calls to i18next
   * Example: t("report.testsFound", { count: 11 })
   */
  const t = (path, params = {}) => {
    // Try i18next first (it handles fallback to English internally)
    const result = i18nT(path, params);
    
    // If i18next returned the raw key path, try our manual lookup
    if (result === path) {
      const keys = path.split(".");
      let value = keys.reduce((acc, k) => acc?.[k], TRANSLATIONS[lang]);
      if (value === undefined && lang !== "en") {
        value = keys.reduce((acc, k) => acc?.[k], TRANSLATIONS.en);
      }
      if (value === undefined || typeof value !== "string") {
        return keys[keys.length - 1] || path;
      }
      let res = value;
      Object.keys(params).forEach((p) => {
        res = res.replaceAll(`{${p}}`, params[p]);
      });
      return res;
    }
    
    return result;
  };

  /**
   * Helper to translate test status ("normal", "high", "low", "critical", etc.)
   */
  const tStatus = (status) => {
    if (!status) return "";
    const s = String(status).toLowerCase();
    return t(`common.${s}`) || status;
  };

  /**
   * Helper to translate system/category names
   */
  const tCategory = (cat) => {
    if (!cat) return "";
    return TRANSLATIONS[lang]?.categories?.[cat] || TRANSLATIONS.en?.categories?.[cat] || cat;
  };

  /**
   * Helper to translate hospital room categories
   */
  const tRoom = (room) => {
    if (!room) return "";
    return TRANSLATIONS[lang]?.rooms?.[room] || TRANSLATIONS.en?.rooms?.[room] || room;
  };

  /**
   * Helper to translate biomarker / test names if regional translation exists
   */
  const tTestName = (name) => {
    if (!name) return "";
    return TEST_NAME_TRANSLATIONS[lang]?.[name] || name;
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t,
        tStatus,
        tCategory,
        tRoom,
        tTestName,
        languages: LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
