import { useState, useEffect } from 'react';

/**
 * Hook to debounce any fast-changing value by a specified delay.
 *
 * @param {any} value - The input value to debounce
 * @param {number} delay - The debounce delay in milliseconds (default 300ms)
 * @returns {any} - The debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
