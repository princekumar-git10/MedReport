import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanError = (err) =>
    err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim() ||
    "Something went wrong. Please try again.";

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
        <h1>Medical Report Explainer</h1>
        <p className="tag">
          {isSignup
            ? "Create an account to get plain-language explanations of your lab reports."
            : "Log in to continue to your reports."}
        </p>

        <label className="sr-only" htmlFor="email">Email</label>
        <input
          id="email"
          className="authInput"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label className="sr-only" htmlFor="password">Password</label>
        <input
          id="password"
          className="authInput"
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={6}
          required
        />

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="authPrimary" disabled={loading}>
          {loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </button>

        <div className="authDivider"><span>or</span></div>

        <button type="button" className="sampleBtn authGoogle" onClick={handleGoogle}>
          Continue with Google
        </button>

        <p className="authSwitch">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <button type="button" className="authLink" onClick={() => { setIsSignup(!isSignup); setError(""); }}>
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>

        <p className="authNote">
          Educational information only. Not a diagnosis or medical advice.
        </p>
      </form>
    </main>
  );
}