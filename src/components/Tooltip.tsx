import React, { useState, useRef, useEffect } from "react";

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: "top" | "bottom" | "left" | "right";
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = "top" }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isVisible && containerRef.current && tooltipRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            let top = 0;
            let left = 0;

            switch (position) {
                case "top":
                    top = -tooltipRect.height - 8;
                    left = (containerRect.width - tooltipRect.width) / 2;
                    break;
                case "bottom":
                    top = containerRect.height + 8;
                    left = (containerRect.width - tooltipRect.width) / 2;
                    break;
                case "left":
                    top = (containerRect.height - tooltipRect.height) / 2;
                    left = -tooltipRect.width - 8;
                    break;
                case "right":
                    top = (containerRect.height - tooltipRect.height) / 2;
                    left = containerRect.width + 8;
                    break;
            }

            setTooltipStyle({ top: `${top}px`, left: `${left}px` });
        }
    }, [isVisible, position]);

    return (
        <div
            ref={containerRef}
            style={{ position: "relative", display: "inline-block" }}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    style={{
                        position: "absolute",
                        backgroundColor: "var(--bg-dark, #ffffffff)",
                        color: "var(--text-primary, #000000ff)",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "var(--radius-sm, 4px)",
                        fontSize: "0.85rem",
                        whiteSpace: "nowrap",
                        zIndex: 1000,
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                        pointerEvents: "none",
                        ...tooltipStyle,
                    }}
                >
                    {content}
                    <div
                        style={{
                            position: "absolute",
                            width: 0,
                            height: 0,
                            borderStyle: "solid",
                            ...(position === "top" && {
                                bottom: "-6px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                borderWidth: "6px 6px 0 6px",
                                borderColor: "var(--bg-dark, #1a1a1a) transparent transparent transparent",
                            }),
                            ...(position === "bottom" && {
                                top: "-6px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                borderWidth: "0 6px 6px 6px",
                                borderColor: "transparent transparent var(--bg-dark, #1a1a1a) transparent",
                            }),
                            ...(position === "left" && {
                                right: "-6px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                borderWidth: "6px 0 6px 6px",
                                borderColor: "transparent transparent transparent var(--bg-dark, #1a1a1a)",
                            }),
                            ...(position === "right" && {
                                left: "-6px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                borderWidth: "6px 6px 6px 0",
                                borderColor: "transparent var(--bg-dark, #1a1a1a) transparent transparent",
                            }),
                        }}
                    />
                </div>
            )}
        </div>
    );
};
