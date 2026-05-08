import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWindowDimensions } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

const DraggableWebPanelWidthContext = React.createContext<number | null>(null);

export const useDraggableWebPanelWidth = () =>
  React.useContext(DraggableWebPanelWidthContext);

interface DraggableWebPanelProps {
  children: ReactNode;
  initialTop?: number;
  width?: number;
  dragHandle?: ReactNode;
  minWidth?: number;
  resizeHandleInset?: number;
  onWidthChange?: (width: number) => void;
  maxWidthRatio?: number;
  zIndex?: number;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(value, max));
};

const BOTTOM_OVERHANG = 100;

const DraggableWebPanel: React.FC<DraggableWebPanelProps> = ({
  children,
  dragHandle,
  minWidth = 360,
  initialTop = 80,
  width = minWidth,
  resizeHandleInset = 0,
  onWidthChange,
  maxWidthRatio = 0.8,
  zIndex = 50,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxPanelWidth = Math.max(minWidth, windowWidth);
  const initialPanelWidth = Math.min(width, windowWidth * maxWidthRatio);
  const [panelWidth, setPanelWidth] = useState(() =>
    clamp(initialPanelWidth, minWidth, maxPanelWidth),
  );
  const defaultPosition = useMemo(
    () => ({
      x: Math.max(0, windowWidth - panelWidth),
      y: initialTop,
    }),
    [initialTop, panelWidth, windowWidth],
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const positionRef = useRef(defaultPosition);
  const dragStartRef = useRef(defaultPosition);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({
    x: defaultPosition.x,
    pointerX: 0,
    width: panelWidth,
  });
  const frameRef = useRef<number | null>(null);
  const interactionShieldRef = useRef<HTMLDivElement | null>(null);
  const previousUserSelectRef = useRef<string>("");
  const didSetInitialPositionRef = useRef(false);

  const applyPosition = useCallback((position: { x: number; y: number }) => {
    positionRef.current = position;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (!panelRef.current) return;
      panelRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
    });
  }, []);

  const getMaxY = useCallback(() => {
    if (!panelHeight) return Math.max(0, windowHeight - 60 + BOTTOM_OVERHANG);
    return Math.max(0, windowHeight - panelHeight - 8 + BOTTOM_OVERHANG);
  }, [panelHeight, windowHeight]);

  useEffect(() => {
    if (didSetInitialPositionRef.current) return;
    didSetInitialPositionRef.current = true;
    applyPosition(defaultPosition);
  }, [applyPosition, defaultPosition]);

  useEffect(() => {
    applyPosition({
      x: clamp(positionRef.current.x, 0, Math.max(0, windowWidth - panelWidth)),
      y: clamp(positionRef.current.y, 0, getMaxY()),
    });
  }, [applyPosition, getMaxY, panelHeight, panelWidth, windowWidth]);

  useEffect(() => {
    setPanelWidth((currentWidth) =>
      clamp(currentWidth, minWidth, maxPanelWidth),
    );
  }, [maxPanelWidth, minWidth]);

  useEffect(() => {
    onWidthChange?.(panelWidth);
  }, [onWidthChange, panelWidth]);

  useEffect(() => {
    if (!panelRef.current) return;

    const updateHeight = () => {
      if (!panelRef.current) return;
      setPanelHeight(panelRef.current.getBoundingClientRect().height);
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(panelRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      interactionShieldRef.current?.remove();
      interactionShieldRef.current = null;
    };
  }, []);

  const createInteractionShield = useCallback(
    (cursor: string) => {
      previousUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";

      const interactionShield = document.createElement("div");
      interactionShield.style.position = "fixed";
      interactionShield.style.inset = "0";
      interactionShield.style.zIndex = String(zIndex - 1);
      interactionShield.style.cursor = cursor;
      interactionShield.style.touchAction = "none";
      interactionShield.style.background = "transparent";
      document.body.appendChild(interactionShield);
      interactionShieldRef.current = interactionShield;

      return interactionShield;
    },
    [zIndex],
  );

  const clearInteractionShield = useCallback(
    (interactionShield: HTMLDivElement) => {
      interactionShield.remove();
      if (interactionShieldRef.current === interactionShield) {
        interactionShieldRef.current = null;
      }
      document.body.style.userSelect = previousUserSelectRef.current;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragStartRef.current = positionRef.current;
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
      const dragShield = createInteractionShield("move");

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
            getMaxY(),
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
        clearInteractionShield(dragShield);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      dragShield.addEventListener("pointermove", handlePointerMove);
      dragShield.addEventListener("pointerup", handlePointerUp);
      dragShield.addEventListener("pointercancel", handlePointerUp);
    },
    [
      applyPosition,
      clearInteractionShield,
      createInteractionShield,
      getMaxY,
      panelWidth,
      windowWidth,
    ],
  );

  const handleResizePointerDown = useCallback(
    (edge: "left" | "right") => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      resizeStartRef.current = {
        x: positionRef.current.x,
        pointerX: event.clientX,
        width: panelWidth,
      };

      const resizeShield = createInteractionShield("ew-resize");

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();

        const deltaX = moveEvent.clientX - resizeStartRef.current.pointerX;
        const startX = resizeStartRef.current.x;
        const startWidth = resizeStartRef.current.width;

        if (edge === "right") {
          const nextWidth = clamp(
            startWidth + deltaX,
            minWidth,
            windowWidth - startX,
          );
          setPanelWidth(nextWidth);
          return;
        }

        const startRight = startX + startWidth;
        const nextWidth = clamp(startWidth - deltaX, minWidth, startRight);
        const nextX = startRight - nextWidth;
        setPanelWidth(nextWidth);
        applyPosition({
          x: nextX,
          y: clamp(positionRef.current.y, 0, getMaxY()),
        });
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        resizeShield.removeEventListener("pointermove", handlePointerMove);
        resizeShield.removeEventListener("pointerup", handlePointerUp);
        resizeShield.removeEventListener("pointercancel", handlePointerUp);
        clearInteractionShield(resizeShield);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      resizeShield.addEventListener("pointermove", handlePointerMove);
      resizeShield.addEventListener("pointerup", handlePointerUp);
      resizeShield.addEventListener("pointercancel", handlePointerUp);
    },
    [
      applyPosition,
      clearInteractionShield,
      createInteractionShield,
      getMaxY,
      minWidth,
      panelWidth,
      windowWidth,
    ],
  );

  const handleSnapRightMin = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setPanelWidth(minWidth);
      applyPosition({
        x: Math.max(0, windowWidth - minWidth),
        y: clamp(positionRef.current.y, 0, getMaxY()),
      });
    },
    [applyPosition, getMaxY, minWidth, windowWidth],
  );

  const handleSnapFullBottom = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const applyBottomPosition = () => {
        const nextPanelHeight =
          panelRef.current?.getBoundingClientRect().height ?? panelHeight;
        applyPosition({
          x: 0,
          y: Math.max(0, windowHeight - nextPanelHeight - 8 + BOTTOM_OVERHANG),
        });
      };

      setPanelWidth(windowWidth);
      applyPosition({
        x: 0,
        y: getMaxY(),
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          applyBottomPosition();
        });
      });
    },
    [applyPosition, getMaxY, panelHeight, windowHeight, windowWidth],
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
        boxSizing: "border-box",
        willChange: "transform",
      },
    },
    React.createElement("div", {
      onPointerDown: handleResizePointerDown("left"),
      style: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: resizeHandleInset - 4,
        width: 8,
        zIndex: 3,
        cursor: "ew-resize",
        touchAction: "none",
      },
    }),
    React.createElement("div", {
      onPointerDown: handleResizePointerDown("right"),
      style: {
        position: "absolute",
        top: 0,
        bottom: 0,
        right: resizeHandleInset - 4,
        width: 8,
        zIndex: 3,
        cursor: "ew-resize",
        touchAction: "none",
      },
    }),
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 4,
          right: 32,
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          gap: 2,
          pointerEvents: "auto",
        },
      },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleSnapFullBottom,
          title: "Expand to full width",
          style: {
            width: 14,
            height: 14,
            padding: 0,
            border: 0,
            background: "transparent",
            appearance: "none",
            boxSizing: "border-box",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
          },
        },
        React.createElement(MaterialCommunityIcons, {
          name: "border-bottom-variant",
          size: 14,
          color: "rgba(74, 105, 189, 0.5)",
          style: { lineHeight: 14 },
        }),
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleSnapRightMin,
          title: "Collapse to right",
          style: {
            width: 14,
            height: 14,
            padding: 0,
            border: 0,
            background: "transparent",
            appearance: "none",
            boxSizing: "border-box",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
          },
        },
        React.createElement(MaterialCommunityIcons, {
          name: "border-right-variant",
          size: 14,
          color: "rgba(74, 105, 189, 0.5)",
          style: { lineHeight: 14 },
        }),
      ),
    ),
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
    React.createElement(
      DraggableWebPanelWidthContext.Provider,
      { value: panelWidth },
      children,
    ),
  );
};

export default DraggableWebPanel;
