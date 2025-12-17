import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = "primary",
    size = "md",
    icon,
    className = "",
    ...props
}) => {
    const baseClass = "btn";
    const variantClass = variant === "primary" ? "" : `btn-${variant}`;
    // We can add size classes later if needed in global CSS

    return (
        <button
            className={`${baseClass} ${variantClass} ${className}`}
            {...props}
        >
            {icon && <span style={{ marginRight: "0.5rem" }}>{icon}</span>}
            {children}
        </button>
    );
};
