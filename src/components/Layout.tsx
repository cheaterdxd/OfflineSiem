import React from "react";

interface LayoutProps {
    children: React.ReactNode;
    currentView: string;
    onNavigate: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "rules", label: "Rules Manager", icon: "🛡️" },
    ];

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* Sidebar */}
            <aside style={{
                width: "250px",
                backgroundColor: "var(--bg-card)",
                borderRight: "1px solid var(--border-color)",
                padding: "1rem"
            }}>
                <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 32, height: 32, background: "var(--primary)", borderRadius: 8 }}></div>
                    <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Offline SIEM</h2>
                </div>

                <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            style={{
                                background: currentView === item.id ? "var(--bg-input)" : "transparent",
                                border: "none",
                                color: currentView === item.id ? "var(--primary)" : "var(--text-secondary)",
                                padding: "0.75rem 1rem",
                                borderRadius: "var(--radius-md)",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                fontSize: "0.95rem",
                                fontWeight: currentView === item.id ? 600 : 400,
                                transition: "all 0.2s"
                            }}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, overflow: "auto", padding: "2rem" }}>
                {children}
            </main>
        </div>
    );
};
