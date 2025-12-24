import React from "react";

interface LayoutProps {
    children: React.ReactNode;
    currentView: string;
    onNavigate: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
    const menuItems = [
        { id: "dashboard", label: "Dashboard" },
        { id: "rules", label: "Rules Manager" },
        { id: "settings", label: "Settings" },
    ];

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* Sidebar */}
            <aside style={{
                width: "250px",
                backgroundColor: "var(--bg-card)",
                borderRight: "1px solid var(--border-color)",
                padding: "1.5rem 1rem",
                boxShadow: "var(--shadow-sm)"
            }}>
                <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <img
                        src="/vcs_logo.svg"
                        alt="VCS Logo"
                        style={{ width: 32, height: 32 }}
                    />
                    <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Offline SIEM</h2>
                </div>

                <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            style={{
                                background: currentView === item.id ? "var(--primary-light)" : "transparent",
                                border: currentView === item.id ? "1px solid var(--primary)" : "1px solid transparent",
                                color: currentView === item.id ? "var(--primary)" : "var(--text-secondary)",
                                padding: "0.75rem 1rem",
                                borderRadius: "var(--radius-md)",
                                textAlign: "left",
                                cursor: "pointer",
                                fontSize: "0.95rem",
                                fontWeight: currentView === item.id ? 600 : 500,
                                transition: "all 0.15s",
                                width: "100%"
                            }}
                            onMouseEnter={(e) => {
                                if (currentView !== item.id) {
                                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentView !== item.id) {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                }
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, overflow: "auto", padding: "2rem", backgroundColor: "var(--bg-secondary)" }}>
                {children}
            </main>
        </div>
    );
};
