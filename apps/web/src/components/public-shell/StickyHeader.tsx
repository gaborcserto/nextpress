"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./StickyHeader.module.css";

export function StickyHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const header = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = header.current?.previousElementSibling;

    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry.isIntersecting);
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={header}
      className={`${className} ${styles.header}`}
      data-scrolled={scrolled}
    >
      {children}
    </header>
  );
}
