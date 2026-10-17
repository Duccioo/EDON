import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeImage } from "../../../packages/shared/model";

export function MarkdownContent({
  text,
  className = "",
  inline = false,
}: {
  text: string;
  className?: string;
  inline?: boolean;
}) {
  const content = (
    <Markdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        a: ({ children, href }) =>
          inline ? (
            <span>{children}</span>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        img: ({ src, alt }) =>
          src && safeImage(src) ? (
            <img src={src} alt={alt ?? ""} loading="lazy" />
          ) : (
            <span>{alt}</span>
          ),
        ...(inline
          ? {
              p: ({ children }: { children?: React.ReactNode }) => (
                <span>{children}</span>
              ),
            }
          : {}),
      }}
    >
      {text}
    </Markdown>
  );
  return inline ? (
    <span className="markdown-inline">{content}</span>
  ) : (
    <div className={`markdown-content ${className}`}>{content}</div>
  );
}
