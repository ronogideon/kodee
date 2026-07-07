import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Properties } from "./pages/Properties";
import { Tenants } from "./pages/Tenants";
import { Payments } from "./pages/Payments";
import { Expenses } from "./pages/Expenses";
import { Requests } from "./pages/Requests";
import { Team } from "./pages/Team";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/properties" element={<Properties />} />
      <Route path="/tenants" element={<Tenants />} />
      <Route path="/payments" element={<Payments />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/requests" element={<Requests />} />
      <Route path="/team" element={<Team />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
