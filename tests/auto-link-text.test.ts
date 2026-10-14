import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AutoLinkText } from '../src/components/ui/auto-link-text';

test('AutoLinkText: renders null for empty or null text', () => {
  assert.equal(renderToStaticMarkup(React.createElement(AutoLinkText, { text: null })), '');
  assert.equal(renderToStaticMarkup(React.createElement(AutoLinkText, { text: undefined })), '');
  assert.equal(renderToStaticMarkup(React.createElement(AutoLinkText, { text: '' })), '');
});

test('AutoLinkText: renders plain text without modification when no URLs present', () => {
  const html = renderToStaticMarkup(React.createElement(AutoLinkText, { text: 'Yêu cầu in 3D nhựa PLA màu đỏ' }));
  assert.equal(html, 'Yêu cầu in 3D nhựa PLA màu đỏ');
});

test('AutoLinkText: converts MakerWorld URL into a clickable <a> link', () => {
  const text = '[Yêu cầu báo giá MakerWorld nhanh] - Link mô hình: https://makerworld.com/en/models/3246150-frankens';
  const html = renderToStaticMarkup(React.createElement(AutoLinkText, { text }));

  assert.ok(html.includes('<a href="https://makerworld.com/en/models/3246150-frankens"'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noreferrer"'));
  assert.ok(html.includes('[Yêu cầu báo giá MakerWorld nhanh] - Link mô hình: '));
});

test('AutoLinkText: trims trailing punctuation from href', () => {
  const text = 'Xem tại https://makerworld.com/en/models/123456.';
  const html = renderToStaticMarkup(React.createElement(AutoLinkText, { text }));

  assert.ok(html.includes('href="https://makerworld.com/en/models/123456"'));
  assert.ok(html.endsWith('.'));
});
