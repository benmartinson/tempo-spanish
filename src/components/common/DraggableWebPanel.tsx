import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useWindowDimensions } from "react-native";

interface DraggableWebPanelProps {
  children: ReactNode;
  initialTop: number;
  width: number;
  dragHandle?: ReactNode;
  maxWidthRatio?: number;
  zIndex?: number;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(value, max));
};

const DraggableWebPanel: React.FC<DraggableWebPanelProps> = ({
  children,
  initialTop,
  width,
  dragHandle,
  maxWidthRatio = 0.8,
  zIndex = 50,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const panelWidth = Math.min(width, windowWidth * maxWidthRatio);
  const defaultPosition = useMemo(
    () => ({
      x: Math.max(0, (windowWidth - panelWidth) / 2),
      y: initialTop,
    }),
    [initialTop, panelWidth, windowWidth],
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(defaultPosition);
  const dragStartRef = useRef(defaultPosition);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const dragShieldRef = useRef<HTMLDivElement | null>(null);
  const previousUserSelectRef = useRef<string>("");

  const applyPosition = useCallback((position: { x: number; y: number }) => {
    positionRef.current = position;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (!panelRef.current) return;
      panelRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
    });
  }, []);

  useEffect(() => {
    applyPosition(defaultPosition);
  }, [applyPosition, defaultPosition]);

  useEffect(() => {
    applyPosition({
      x: clamp(positionRef.current.x, 0, Math.max(0, windowWidth - panelWidth)),
      y: clamp(positionRef.current.y, 0, Math.max(0, windowHeight - 60)),
    });
  }, [applyPosition, panelWidth, windowHeight, windowWidth]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      dragShieldRef.current?.remove();
      dragShieldRef.current = null;
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragStartRef.current = positionRef.current;
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
      previousUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";

      const dragShield = document.createElement("div");
      dragShield.style.position = "fixed";
      dragShield.style.inset = "0";
      dragShield.style.zIndex = String(zIndex - 1);
      dragShield.style.cursor = "move";
      dragShield.style.touchAction = "none";
      dragShield.style.background = "transparent";
      document.body.appendChild(dragShield);
      dragShieldRef.current = dragShield;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        applyPosition({
          x: clamp(
            dragStartRef.current.x +
              moveEvent.clientX -
              pointerStartRef.current.x,
            0,
            Math.max(0, windowWidth - panelWidth),
          ),
          y: clamp(
            dragStartRef.current.y +
              moveEvent.clientY -
              pointerStartRef.current.y,
            0,
            Math.max(0, windowHeight - 60),
          ),
        });
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        dragShield.removeEventListener("pointermove", handlePointerMove);
        dragShield.removeEventListener("pointerup", handlePointerUp);
        dragShield.removeEventListener("pointercancel", handlePointerUp);
        dragShield.remove();
        if (dragShieldRef.current === dragShield) {
          dragShieldRef.current = null;
        }
        document.body.style.userSelect = previousUserSelectRef.current;
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      dragShield.addEventListener("pointermove", handlePointerMove);
      dragShield.addEventListener("pointerup", handlePointerUp);
      dragShield.addEventListener("pointercancel", handlePointerUp);
    },
    [applyPosition, panelWidth, windowHeight, windowWidth, zIndex],
  );

  return React.createElement(
    "div",
    {
      ref: panelRef,
      style: {
        position: "fixed",
        left: 0,
        top: 0,
        width: panelWidth,
        zIndex,
        willChange: "transform",
      },
    },
    dragHandle
      ? React.createElement(
          "div",
          {
            onPointerDown: handlePointerDown,
            style: {
              cursor: "move",
              touchAction: "none",
            },
          },
          dragHandle,
        )
      : React.createElement("div", {
          onPointerDown: handlePointerDown,
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 22,
            zIndex: 1,
            cursor: "move",
            touchAction: "none",
          },
        }),
    children,
  );
};

export default DraggableWebPanel;
