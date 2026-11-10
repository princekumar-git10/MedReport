import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useLanguage } from "../context/LanguageContext";

export default function Login() {
  const { t, lang, setLang, languages } = useLanguage();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanError = (err) =>
    err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim() ||
    t("login.genericError");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(cleanError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(cleanError(err));
    }
  };

  return (
    <main className="authPage">
      <form className="authCard" onSubmit={handleSubmit}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <select
            className="lang-select-pill"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t("nav.selectLang")}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
        </div>

        <h1>{t("login.title")}</h1>
        <p className="tag">
          {isSignup ? t("login.tagSignup") : t("login.tagLogin")}
        </p>

        <label className="sr-only" htmlFor="email">{t("login.email")}</label>
        <input
          id="email"
          className="authInput"
          type="email"
          placeholder={t("login.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label className="sr-only" htmlFor="password">{t("login.password")}</label>
        <input
          id="password"
          className="authInput"
          type="password"
          placeholder={t("login.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={6}
          required
        />

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="authPrimary" disabled={loading}>
          {loading ? t("common.pleaseWait") : isSignup ? t("login.createAccount") : t("login.loginBtn")}
        </button>

        <div className="authDivider"><span>{t("common.or")}</span></div>

        <button type="button" className="sampleBtn authGoogle" onClick={handleGoogle}>
          {t("login.googleLogin")}
        </button>

        <p className="authSwitch">
          {isSignup ? t("login.alreadyAccount") : t("login.newHere")}{" "}
          <button type="button" className="authLink" onClick={() => { setIsSignup(!isSignup); setError(""); }}>
            {isSignup ? t("login.loginLink") : t("login.signupLink")}
          </button>
        </p>

        <p className="authNote">
          {t("login.note")}
        </p>
      </form>
    </main>
  );
}
