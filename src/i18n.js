/**
 * i18next initialization for MediSync AI
 * Bridges with existing LanguageContext for backward compatibility
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { TRANSLATIONS } from "./locales/translations.js";

// Convert our flat nested TRANSLATIONS object into i18next resource format
const resources = {};
for (const langCode of Object.keys(TRANSLATIONS)) {
  resources[langCode] = {
    translation: TRANSLATIONS[langCode],
  };
}

const initialLang = (typeof window !== "undefined" && window.localStorage)
  ? (localStorage.getItem("medreport_language") || "en")
  : "en";

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes
      prefix: "{",
      suffix: "}",
    },
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => {
      // Return the last segment of the key as a readable fallback
      const parts = key.split(".");
      return parts[parts.length - 1] || key;
    },
  });

export default i18n;
