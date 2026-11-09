import type { ReactNode } from 'react';

export function Card({ tone = 'light', title, subtitle, children, className = '' }: {
  tone?: 'light' | 'dark' | 'yellow';
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${tone} ${className}`} data-aos="fade-up">
      <h3>{title}</h3>
      {subtitle && <div className="sub">{subtitle}</div>}
      {children}
    </section>
  );
}
