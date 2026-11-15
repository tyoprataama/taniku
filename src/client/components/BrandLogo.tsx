import { useTheme } from "../theme";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  const { isDark } = useTheme();

  const logoPath = isDark
    ? `${import.meta.env.BASE_URL}taniku-y.png`
    : `${import.meta.env.BASE_URL}taniku-b.png`;

  return (
    <div
      role="img"
      aria-label="Taniku"
      className={`shrink-0 bg-contain bg-center bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url("${logoPath}")`,
      }}
    />
  );
}
