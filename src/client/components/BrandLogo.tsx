import { useTheme } from "../theme";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  const { isDark } = useTheme();

  return (
    <div
      aria-label="Taniku"
      role="img"
      className={`shrink-0 bg-contain bg-center bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url(${isDark ? "/taniku-y.png" : "/taniku-b.png"})`,
      }}
    />
  );
}
