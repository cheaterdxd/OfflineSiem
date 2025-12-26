import { useState } from "react";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { RulesPage } from "./pages/RulesPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

function App() {
  const [currentView, setCurrentView] = useState("dashboard");

  const renderContent = () => {
    return (
      <>
        <div style={{ display: currentView === "dashboard" ? "block" : "none" }}>
          <DashboardPage />
        </div>
        <div style={{ display: currentView === "rules" ? "block" : "none" }}>
          <RulesPage />
        </div>
        <div style={{ display: currentView === "settings" ? "block" : "none" }}>
          <SettingsPage />
        </div>
      </>
    );
  };

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderContent()}
    </Layout>
  );
}

export default App;
