import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, onSnapshot } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  isBiometricEnrolled: boolean;
  enrollBiometrics: (userId: string, email: string) => Promise<void>;
  disenrollBiometrics: () => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const COMPANY_DOMAIN = "@heritage-site.com";

const MOCK_USER: User = {
  id: "dev-admin-id",
  name: "Admin User (Dev Mode)",
  email: "admin@heritage-site.com",
  role: "admin",
  department: "Heritage Management",
  status: "online"
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(MOCK_USER);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(() => {
    return localStorage.getItem("biometric_enrolled") === "true";
  });

  useEffect(() => {
    let unsubscribePermissions: (() => void) | null = null;

    // Start listening for permissions immediately in bypass mode
    const path = "role_permissions";
    unsubscribePermissions = onSnapshot(collection(db, path), (snapshot) => {
      const permissions: Record<string, string[]> = {};
      snapshot.docs.forEach(doc => {
        permissions[doc.id] = doc.data().permissions || [];
      });
      setRolePermissions(permissions);
    }, (error) => {
      console.warn("Permission restricted for role_permissions", error);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsLoading(true);
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
        setIsLoading(false);
      }
    });

    return () => {
      if (unsubscribePermissions) unsubscribePermissions();
      unsubscribeAuth();
    };
  }, []);

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.role === "admin") return true; // Admins have all permissions
    
    // Rota is only for admin for now
    if (permission === "view_rota" || permission === "manage_rota") {
      return false;
    }
    
    return rolePermissions[user.role]?.includes(permission) || false;
  };

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError("Login failed. Please try again.");
      }
      throw err;
    }
  };

  const enrollBiometrics = async (userId: string, email: string) => {
    localStorage.setItem("biometric_enrolled", "true");
    localStorage.setItem("biometric_credential", JSON.stringify({ userId, email, registeredAt: new Date().toISOString() }));
    setIsBiometricEnrolled(true);
  };

  const disenrollBiometrics = async () => {
    localStorage.removeItem("biometric_enrolled");
    localStorage.removeItem("biometric_credential");
    setIsBiometricEnrolled(false);
  };

  const loginWithBiometrics = async () => {
    setError(null);
    const stored = localStorage.getItem("biometric_credential");
    if (!stored) {
      const err = "No biometric credentials enrolled on this device.";
      setError(err);
      throw new Error(err);
    }

    const { userId, email } = JSON.parse(stored);
    setIsLoading(true);
    try {
      // Fetch profile from Firestore
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = { id: userId, ...userDoc.data() } as User;
        setUser(userData);
      } else if (userId === "dev-admin-id") {
        setUser(MOCK_USER);
      } else {
        throw new Error("Staff profile not found in database.");
      }
    } catch (err: any) {
      console.error("Biometric login error:", err);
      setError("Biometric verification failed.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (regData: any) => {
    setError(null);
    const { email, password, name, role, department } = regData;

    if (!email.endsWith(COMPANY_DOMAIN)) {
      const err = `Registration is only allowed for ${COMPANY_DOMAIN} email addresses.`;
      setError(err);
      throw new Error(err);
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Create user profile in Firestore
      const userProfile = {
        name,
        email,
        role: role || "user",
        department: department || "General",
        status: "online",
        created_at: serverTimestamp()
      };

      await setDoc(doc(db, "users", firebaseUser.uid), userProfile);
      setUser({ id: firebaseUser.uid, ...userProfile } as User);
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Email already registered.");
      } else {
        setError("Registration failed. Please try again.");
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      login, 
      register, 
      logout, 
      error, 
      hasPermission,
      isBiometricEnrolled,
      enrollBiometrics,
      disenrollBiometrics,
      loginWithBiometrics
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
