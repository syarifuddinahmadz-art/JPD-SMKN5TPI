export function BrandMark({
  variant = 'dark',
  size = 40,
}: {
  variant?: 'dark' | 'light';
  size?: number;
}) {
  const outerFill = variant === 'dark' ? '#102D46' : '#FFFFFF';
  const bookFill = variant === 'dark' ? '#FFFFFF' : '#102D46';
  const accentFill = '#16A6A0';
  const lineFill = '#1C678A';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="40" height="40" rx="10" fill={outerFill} />
      <path
        d="M11 12.5C11 11.6716 11.6716 11 12.5 11H24.5C26.9853 11 29 13.0147 29 15.5V27.5C29 28.3284 28.3284 29 27.5 29H12.5C11.6716 29 11 28.3284 11 27.5V12.5Z"
        fill={bookFill}
      />
      <rect x="14.5" y="15" width="9" height="2.2" rx="1.1" fill={lineFill} />
      <rect x="14.5" y="19.2" width="11" height="2.2" rx="1.1" fill={lineFill} opacity="0.65" />
      <rect x="14.5" y="23.4" width="7" height="2.2" rx="1.1" fill={accentFill} />
      <circle cx="29" cy="11" r="4" fill={accentFill} />
    </svg>
  );
}
