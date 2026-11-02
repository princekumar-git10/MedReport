import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./components/Login";
import Splash from "./components/Splash";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // keep splash visible briefly so it doesn't just flash
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 900);
    return () => clearTimeout(t);
  }, []);

  if (user === undefined || !minTimePassed) return <Splash leaving={false} />;
  if (!user) return <Login />;
  return children;
}