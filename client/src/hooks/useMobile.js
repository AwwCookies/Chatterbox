import { useState, useEffect, useCallback } from 'react';

// Breakpoints matching Tailwind defaults
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useMobile() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Debounce resize handler
    let timeoutId;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const isMobile = windowSize.width < MOBILE_BREAKPOINT;
  const isTablet = windowSize.width >= MOBILE_BREAKPOINT && windowSize.width < TABLET_BREAKPOINT;
  const isDesktop = windowSize.width >= TABLET_BREAKPOINT;

  return {
    isMobile,
    isTablet,
    isDesktop,
    windowSize,
  };
}

// Hook for detecting touch devices
export function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
      );
    };
    checkTouch();
  }, []);

  return isTouch;
}

// Hook for handling swipe gestures
export function useSwipe(onSwipeLeft, onSwipeRight, options = {}) {
  const { threshold = 50, enabled = true } = options;
  
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const onTouchStart = useCallback((e) => {
    if (!enabled) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, [enabled]);

  const onTouchMove = useCallback((e) => {
    if (!enabled) return;
    setTouchEnd(e.targetTouches[0].clientX);
  }, [enabled]);

  const onTouchEnd = useCallback(() => {
    if (!enabled || !touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
  }, [enabled, touchStart, touchEnd, threshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

// Hook for pull-to-refresh functionality
export function usePullToRefresh(onRefresh, options = {}) {
  const { threshold = 80, enabled = true } = options;
  
  const [startY, setStartY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e) => {
    if (!enabled || refreshing) return;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setPulling(true);
    }
  }, [enabled, refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || !enabled || refreshing) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY);
    
    // Apply resistance
    const resistance = 0.5;
    const resistedDistance = Math.min(distance * resistance, threshold * 1.5);
    
    setPullDistance(resistedDistance);
    
    if (resistedDistance > 10) {
      e.preventDefault();
    }
  }, [pulling, enabled, refreshing, startY, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || !enabled) return;
    
    if (pullDistance >= threshold && onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    
    setPulling(false);
    setPullDistance(0);
  }, [pulling, enabled, pullDistance, threshold, onRefresh]);

  const reset = useCallback(() => {
    setPulling(false);
    setPullDistance(0);
    setRefreshing(false);
  }, []);

  return {
    pullDistance,
    refreshing,
    isPulling: pulling && pullDistance > 0,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    reset,
  };
}

// Hook for viewport height (handles mobile browser chrome)
export function useViewportHeight() {
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight * 0.01 : 8);

  useEffect(() => {
    const updateVh = () => {
      setVh(window.innerHeight * 0.01);
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };

    updateVh();
    window.addEventListener('resize', updateVh);
    window.addEventListener('orientationchange', updateVh);

    return () => {
      window.removeEventListener('resize', updateVh);
      window.removeEventListener('orientationchange', updateVh);
    };
  }, []);

  return vh;
}

// Hook for safe area insets (notch, etc.)
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10),
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10),
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);
    return () => window.removeEventListener('resize', updateSafeArea);
  }, []);

  return safeArea;
}

export default useMobile;
