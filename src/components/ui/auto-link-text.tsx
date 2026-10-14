'use client';

import React, { Fragment } from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

interface AutoLinkTextProps {
  text: string | null | undefined;
  className?: string;
}

/**
 * Splits text by URLs (http:// or https://) and renders links as clickable <a> tags.
 * Automatically trims trailing punctuation (.,;:!?) so punctuation doesn't break the URL.
 */
export function AutoLinkText({ text, className }: AutoLinkTextProps) {
  if (!text) return null;

  const parts = text.split(URL_REGEX);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;
        if (/^https?:\/\//i.test(part)) {
          const match = part.match(/^(https?:\/\/[^\s]+?)([.,;:!?)\]}>"'`]*)$/);
          const url = match ? match[1] : part;
          const trailing = match ? match[2] : '';

          return (
            <Fragment key={index}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={className ?? 'text-primary underline underline-offset-2 hover:text-primary/80 break-all font-medium'}
                onClick={(e) => e.stopPropagation()}
              >
                {url}
              </a>
              {trailing}
            </Fragment>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
