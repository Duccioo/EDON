import type { Root } from "hast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeImage } from "../../../packages/shared/model";

function editableBlocks() {
  return (tree: Root) => {
    for (const node of tree.children) {
      if (node.type !== "element" || !node.position) continue;
      node.properties["data-source-start"] = node.position.start.offset;
      node.properties["data-source-end"] = node.position.end.offset;
      node.properties.tabIndex = 0;
      node.properties.role = "button";
      node.properties["aria-label"] = "Modifica blocco";
    }
  };
}

export function MarkdownContent({
  text,
  className = "",
  inline = false,
  onEditBlock,
}: {
  text: string;
  className?: string;
  inline?: boolean;
  onEditBlock?: (start: number, end: number) => void;
}) {
  const content = (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={onEditBlock ? [editableBlocks] : []}
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
    <div
      className={`markdown-content ${className}`}
      onClick={
        onEditBlock
          ? (e) => {
              const target = e.target as HTMLElement;
              if (target.closest("a,input")) return;
              const block = target.closest<HTMLElement>("[data-source-start]");
              if (block)
                onEditBlock(
                  Number(block.dataset.sourceStart),
                  Number(block.dataset.sourceEnd),
                );
            }
          : undefined
      }
      onKeyDown={
        onEditBlock
          ? (e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              const block = e.target as HTMLElement;
              if (!block.hasAttribute("data-source-start")) return;
              e.preventDefault();
              onEditBlock(
                Number(block.dataset.sourceStart),
                Number(block.dataset.sourceEnd),
              );
            }
          : undefined
      }
    >
      {content}
    </div>
  );
}
