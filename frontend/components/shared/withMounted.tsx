'use client';
import { useState, useEffect } from 'react';

export function withMounted<T extends object>(Component: React.ComponentType<T>) {
  return function MountedComponent(props: T) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return <Component {...props} />;
  };
}
