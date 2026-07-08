import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import { Shell } from "./components/Shell";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Requests } from "./pages/Requests";
import { History } from "./pages/History";
import { MeterReadings } from "./pages/MeterReadings";
// Landlord console
import { Dashboard } from "./pages/landlord/Dashboard";
import { Properties } from "./pages/landlord/Properties";
import { Tenants } from "./pages/landlord/Tenants";
import { Payments } from "./pages/landlord/Payments";
import { Expenses } from "./pages/landlord/Expenses";
import { Requests as LandlordRequests } from "./pages/landlord/Requests";
import { Team } from "./pages/landlord/Team";
import { Messages } from "./pages/landlord/Messages";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Login />;

  // Landlords get the full console (its pages carry their own Layout).
  if (user.role === "LANDLORD") {
    return (
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/properties" element={<Properties />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/requests" element={<LandlordRequests />} />
        <Route path="/team" element={<Team />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Renters + caretakers get the mobile shell.
  return (
    <Shell>
      {user.role === "CARETAKER" ? (
        <Routes>
          <Route path="/" element={<MeterReadings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Shell>
  );
}
