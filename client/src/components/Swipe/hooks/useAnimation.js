import { useState, useRef } from "react";
import { useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";

const VELOCITY_THRESHOLD = 0.1;
const MAX_ROTATION = 20;
const FLY_RANGE = 300;

const IS_DEVELOPMENT = import.meta.env.DEV;

//Not sure which one would annoy the user most
//Currently if it reaches the boundary and the cursor is moved back a little it will not trigger a fly out!

const shouldTriggerFlyOut = (vx, mx, dir, boundary, reversedDirection) => {

  if (reversedDirection) return false;

  if (dir === 0 && Math.abs(mx) >= boundary) {
    return true;
  }
  if ((mx < 0 && dir !== -1) || (mx > 0 && dir !== 1)) {
    return false;
  }
  return vx > VELOCITY_THRESHOLD || Math.abs(mx) >= boundary;
};

const hasDirectionReversed = (currentMx, prevMx) => {
  if (Math.abs(currentMx) < Math.abs(prevMx)) {
    return true;
  }
  return false;
}


const hasKeptDirection = (currentMx, prevMx) => {
  if (Math.abs(currentMx) > Math.abs(prevMx)) {
    return true;
  }
  return false;
}

const calculateMovementAndBoundary = (mx, halfCardWidth, deckWidth) => {
  const boundary = deckWidth - halfCardWidth;
  const clampedX = Math.min(Math.max(mx, -boundary), boundary);
  return { clampedX, boundary };
};

const useAnimation = (deckWidth, onSwipeOut) => {
  const [debugInfo, setDebugInfo] = useState({
    clampedX: 0,
    currentMx: 0,
    previousMx: 0,
    rotation: 0,
    velocity: 0,
    direction: 0,
    isDirectionReversed: false,
    trigger: false,
  });

  const [{ x, rotateZ, scale, opacity }, api] = useSpring(() => ({
    x: 0,
    rotateZ: 0,
    scale: 1,
    opacity: 1,
  }));

  const prevMxRef = useRef(0);
  const reversedDirectionRef = useRef(false);


  const updateDirectionReversedRef = (currentMx) => {
    const prevMx = prevMxRef.current;
    const currentReversedDirectionState = hasDirectionReversed(currentMx, prevMx);

    prevMxRef.current = currentMx;

    if (hasDirectionReversed(currentMx, prevMx) || hasKeptDirection(currentMx, prevMx)) {
      reversedDirectionRef.current = currentReversedDirectionState;
    }
  }

  const bind = useDrag(
    ({
      event,
      active,
      movement: [mx],
      velocity: [vx],
      direction: [xDir],
    }) => {
      event.preventDefault();
      const halfCardWidth = deckWidth / 2; // Simplified
      if (halfCardWidth < 0) {
        throw new Error("The card width is smaller than zero!");
      }

      const { clampedX, boundary } = calculateMovementAndBoundary(mx, halfCardWidth, deckWidth);


      updateDirectionReversedRef(mx);

      const trigger = shouldTriggerFlyOut(vx, mx, xDir, boundary, reversedDirectionRef.current);


      if (IS_DEVELOPMENT) {
        setDebugInfo({
          clampedX: clampedX,
          currentMx: mx,
          previousMx: prevMxRef.current,
          rotation: (clampedX / boundary) * MAX_ROTATION,
          velocity: vx,
          direction: xDir,
          isDirectionReversed: reversedDirectionRef.current,
          trigger: trigger,
        });
      }

      // Handle dragging animation
      if (active) {
        api.start({
          x: clampedX,
          rotateZ: (clampedX / boundary) * MAX_ROTATION,
          scale: 1.1,
          opacity: 1,
          config: { friction: 50, tension: 800 },
        });
      } else if (!active && trigger) {
        // Trigger fallout animation
        api.start({
          x: FLY_RANGE * (mx > 0 ? 1 : -1),
          rotateZ: (clampedX / boundary) * MAX_ROTATION,
          opacity: 0,
          onRest: onSwipeOut, // Callback when the fallout animation finishes
        });
      } else {
        // Reset animation if not swiping out
        api.start({ x: 0, rotateZ: 0, scale: 1, opacity: 1, config: { friction: 50, tension: 800 } });
      }
    }
  );

  const reset = () => {
    // For debugging purposes
    api.set({ x: 0, rotateZ: 0, scale: 1, opacity: 1 });
    prevMxRef.current = 0;
    reversedDirectionRef.current = false;
  };

  // Combine all animated styles into one object
  const animatedStyles = { x, rotateZ, scale, opacity };

  return {
    bind,
    debugInfo,
    reset,
    animatedStyles,
  };
};

export default useAnimation;