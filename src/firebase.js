import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDWLFvy7FJ2HxPO0Y_wQl_9oD6K3y_DF2w",
  authDomain: "medreport-61f1c.firebaseapp.com",
  projectId: "medreport-61f1c",
  storageBucket: "medreport-61f1c.firebasestorage.app",
  messagingSenderId: "276067926417",
  appId: "1:276067926417:web:ed52ede3d004686025da30",
  measurementId: "G-WB67GFYJ5F"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();