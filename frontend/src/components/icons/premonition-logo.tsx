interface SigmaLogoProps {
  className?: string;
  size?: number;
}

export const SigmaLogo = ({ className, size = 24 }: SigmaLogoProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M75 18H25L55 50L25 82H75"
      stroke="#54BBF7"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M25 18H75"
      stroke="#54BBF7"
      strokeWidth="7"
      strokeLinecap="round"
    />
    <path
      d="M25 82H75"
      stroke="#54BBF7"
      strokeWidth="7"
      strokeLinecap="round"
    />
  </svg>
);

export const PremonitionLogo = SigmaLogo;
export default SigmaLogo;
