import React from "react";
import "../App.css";

interface CardProps {
    children: React.ReactNode;
    title?: string;
    className?: string;
    actions?: React.ReactNode;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, title, className = "", actions, style, onClick }) => {
    return (
        <div
            className={`card ${className}`}
            style={{ ...style, cursor: onClick ? 'pointer' : undefined }}
            onClick={onClick}
        >
            {(title || actions) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    {title && <h3 style={{ margin: 0 }}>{title}</h3>}
                    {actions && <div>{actions}</div>}
                </div>
            )}
            {children}
        </div>
    );
};
