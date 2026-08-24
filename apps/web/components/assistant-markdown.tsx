"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type AssistantMarkdownProps = {
  text: string
  className?: string
}

/** ChatGPT-style markdown for AI companion replies (bold, lists, paragraphs). */
export function AssistantMarkdown({ text, className = "" }: AssistantMarkdownProps) {
  return (
    <div dir="auto" className={`assistant-md text-sm leading-7 text-stone-700 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-navy-950">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-stone-800">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          h1: ({ children }) => (
            <h3 className="mb-2 mt-1 text-base font-semibold text-navy-950">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 mt-1 text-base font-semibold text-navy-950">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1.5 mt-1 text-sm font-semibold text-navy-950">{children}</h4>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-gold-500/50 pl-3 text-stone-600 italic last:mb-0">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClassName }) => {
            const inline = !codeClassName
            if (inline) {
              return (
                <code className="rounded bg-navy-950/5 px-1 py-0.5 text-[0.9em] text-navy-950">
                  {children}
                </code>
              )
            }
            return (
              <code className="block overflow-x-auto rounded-lg bg-navy-950/5 p-3 text-[0.85em] text-navy-950">
                {children}
              </code>
            )
          },
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-gold-800 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-navy-900/10" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
