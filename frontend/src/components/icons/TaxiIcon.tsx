import React from 'react';

interface TaxiIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export default function TaxiIcon({ size = 20, width, height, ...props }: TaxiIconProps) {
  const w = width || size;
  const h = height || size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2 17.5V13.8548C2 12.7181 2.64243 11.679 3.6593 11.1711L4.00027 11.0007L5.15525 7.04595C5.3663 6.1406 6.17335 5.5 7.103 5.5H16.9471C17.8837 5.5 18.6949 6.15 18.899 7.0641L20.0016 11.0007L20.3417 11.1708C21.358 11.679 22 12.7177 22 13.854V17.5C22 18.3285 21.3285 19 20.5 19H19.5016V19.5C19.5016 20.6046 18.6062 21.5 17.5016 21.5C16.3955 21.5 15.5 20.6046 15.5 19.5V19H8.5V19.5002C8.5 20.6047 7.60465 21.5 6.50015 21.5C5.39565 21.5 4.50027 20.6047 4.50027 19.5002V19H3.5C2.67158 19 2 18.3285 2 17.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6.75 16.5C7.44035 16.5 8 15.9404 8 15.25C8 14.5597 7.44035 14 6.75 14C6.05965 14 5.5 14.5597 5.5 15.25C5.5 15.9404 6.05965 16.5 6.75 16.5Z"
        fill="currentColor"
      />
      <path
        d="M17.25 16.5C17.9404 16.5 18.5 15.9404 18.5 15.25C18.5 14.5597 17.9404 14 17.25 14C16.5597 14 16 14.5597 16 15.25C16 15.9404 16.5597 16.5 17.25 16.5Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 5.5H15L14.5044 3.02204C14.4434 2.71702 14.1999 2.5 13.9187 2.5H10.0813C9.8001 2.5 9.5566 2.71702 9.4956 3.02204L9 5.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11.5H16.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
