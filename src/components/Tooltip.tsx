import { useState, cloneElement } from "react";
import { createPortal } from "react-dom";

type TooltipVariant = "delete" | "move" | "cancel";

interface TooltipProps {
  label: string;
  variant: TooltipVariant;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: React.ReactElement<any>;
}

const variantStyles: Record<TooltipVariant, string> = {
  delete: "border border-rose-500 bg-black text-rose-500",
  move:   "border border-cyan-400 bg-black text-cyan-400",
  cancel: "border border-white/60 bg-black text-white",
};

const caretColor: Record<TooltipVariant, string> = {
  delete: "rgb(239 68 68)",
  move:   "rgb(34 211 238)",
  cancel: "rgba(255,255,255,0.6)",
};

export default function Tooltip({ label, variant, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const show = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ top: r.top - 6, left: r.left + r.width / 2 });
    setVisible(true);
  };

  const hide = () => setVisible(false);

  const child = cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      show(e);
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      children.props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {child}
      {visible &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateX(-50%) translateY(-100%)",
              zIndex: 9999,
            }}
            className={`px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap pointer-events-none select-none ${variantStyles[variant]}`}
          >
            {label}
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "100%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: `4px solid ${caretColor[variant]}`,
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
