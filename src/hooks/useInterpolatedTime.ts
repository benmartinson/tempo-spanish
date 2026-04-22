import { useState, useRef, useEffect } from "react";

/**
 * Hook that interpolates playback time to fill the initial gap
 * between when the player starts and when real time updates arrive.
 */
export const useInterpolatedTime = (
  time: number,
  playerIsPlaying: boolean,
  playKey?: number,
  playerSpeed: number = 1,
  segmentStart?: number,
): number => {
  const [localTime, setLocalTime] = useState(time);
  const localTimeRef = useRef(time);
  const timeUpdateCountRef = useRef(0);
  const interpolatingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPlayerIsPlayingRef = useRef(playerIsPlaying);
  const startInterpolation = (startTime: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    timeUpdateCountRef.current = 0;
    interpolatingRef.current = true;
    let counter = 0;
    const speed = playerSpeed || 1;
    const intervalMs = 150 / speed;
    intervalRef.current = setInterval(() => {
      counter++;
      const t = startTime + counter * 0.15;
      localTimeRef.current = t;
      setLocalTime(t);
    }, intervalMs);
  };

  // Detect replay via playKey change
  const prevPlayKeyRef = useRef(playKey);
  useEffect(() => {
    if (playKey !== undefined && playKey !== prevPlayKeyRef.current) {
      prevPlayKeyRef.current = playKey;
      setLocalTime(time);
      localTimeRef.current = time;
      if (playerIsPlaying) {
        startInterpolation(time);
      }
    }
  }, [playKey]);

  // Track incoming time prop updates
  useEffect(() => {
    // Detect replay: time jumped back to near segment start while still playing
    const replayThreshold = (segmentStart ?? 0) + 0.5;
    if (playerIsPlaying && time < localTimeRef.current && time <= replayThreshold) {
      setLocalTime(time);
      localTimeRef.current = time;
      startInterpolation(time);
      return;
    }

    if (interpolatingRef.current) {
      timeUpdateCountRef.current += 1;
      // Second real update means the player is feeding us reliably — stop interpolating
      if (timeUpdateCountRef.current >= 2) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        interpolatingRef.current = false;
      }
    }
    localTimeRef.current = time;
    setLocalTime(time);
  }, [time]);

  // Start/stop interpolation when playerIsPlaying changes
  useEffect(() => {
    const wasPlaying = prevPlayerIsPlayingRef.current;
    prevPlayerIsPlayingRef.current = playerIsPlaying;

    if (playerIsPlaying && !wasPlaying) {
      startInterpolation(time);
    } else if (!playerIsPlaying && wasPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      interpolatingRef.current = false;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playerIsPlaying]);

  return localTime;
};
