import React from "react";

export interface PurchaseIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

/**
 * Purchase Icon by UIX Library on Icon-Icons.com
 * Source & Attribution: "Purchase Icon by UIX Library on <a href="https://icon-icons.com/authors/943-uix-library">Icon-Icons.com</a>"
 */
export const PurchaseIcon: React.FC<PurchaseIconProps> = ({
  size = 20,
  className = "",
  strokeWidth = 2,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Purchase Icon by UIX Library"
      {...props}
    >
      <title>Purchase Icon by UIX Library on Icon-Icons.com</title>
      <desc>Purchase Icon by UIX Library on Icon-Icons.com</desc>
      {/* Shopping bag body */}
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      {/* Bag rim */}
      <path d="M3 6h18" />
      {/* Bag handles */}
      <path d="M16 10a4 4 0 0 1-8 0" />
      {/* Purchase checkmark badge */}
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
};

export default PurchaseIcon;
