import * as React from "react";
import { Link } from "react-router-dom";

interface SmartLinkProps extends React.ComponentPropsWithoutRef<"a"> {
  href: string;
}

export function SmartLink({ href, children, ...props }: SmartLinkProps) {
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  if (href.startsWith("/")) {
    return (
      <Link to={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
