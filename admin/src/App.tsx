import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Landlords } from "./pages/Landlords";
import { Settings } from "./pages/Settings";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Overview />} />
      <Route path="/landlords" element={<Landlords />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
