import React, { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Underline,
} from 'lucide-react';

const ALLOWED_TAGS = new Set([
  'B',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'EM',
  'I',
  'LI',
  'OL',
  'P',
  'STRONG',
  'U',
  'UL',
]);

export const sanitizeRichNoteHtml = (value: string): string => {
  if (typeof DOMParser === 'undefined') return '';

  const documentNode = new DOMParser().parseFromString(value, 'text/html');
  const elements = Array.from(documentNode.body.querySelectorAll('*'));

  elements.forEach((element) => {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) =>
      element.removeAttribute(attribute.name)
    );
  });

  return documentNode.body.innerHTML;
};

export const isRichNoteEmpty = (value: string): boolean => {
  if (typeof DOMParser === 'undefined') return value.trim().length === 0;

  const documentNode = new DOMParser().parseFromString(value, 'text/html');
  return !documentNode.body.textContent?.replace(/\u00a0/g, ' ').trim();
};

interface RichNoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
}

const toolbarActions = [
  { action: 'strong', label: 'Negrito', icon: Bold },
  { action: 'em', label: 'Itálico', icon: Italic },
  { action: 'u', label: 'Sublinhado', icon: Underline },
  { action: 'ul', label: 'Lista com marcadores', icon: List },
  { action: 'ol', label: 'Lista numerada', icon: ListOrdered },
  { action: 'blockquote', label: 'Citação', icon: Quote },
] as const;

type EditorAction = (typeof toolbarActions)[number]['action'];

const applyRangeFormat = (editor: HTMLElement, action: EditorAction) => {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return false;

  const fragment = range.extractContents();
  let formattedNode: HTMLElement;

  if (action === 'ul' || action === 'ol') {
    const list = document.createElement(action);
    const sourceNodes = Array.from(fragment.childNodes);
    const meaningfulNodes = sourceNodes.filter((node) => node.textContent?.trim() || node.nodeType === Node.ELEMENT_NODE);
    for (const node of meaningfulNodes) {
      if (node instanceof HTMLLIElement) {
        list.append(node);
        continue;
      }
      const item = document.createElement('li');
      if (node.nodeType === Node.TEXT_NODE) {
        const lines = (node.textContent || '').split(/\r?\n/).filter((line) => line.trim());
        if (lines.length > 1) {
          lines.forEach((line) => {
            const lineItem = document.createElement('li');
            lineItem.textContent = line.trim();
            list.append(lineItem);
          });
          continue;
        }
      }
      item.append(node);
      list.append(item);
    }
    formattedNode = list;
  } else {
    formattedNode = document.createElement(action);
    formattedNode.append(fragment);
  }

  range.insertNode(formattedNode);
  const nextRange = document.createRange();
  nextRange.selectNodeContents(formattedNode);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
};

export const RichNoteEditor: React.FC<RichNoteEditorProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Registre uma ideia importante...',
  ariaLabel,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;

    const safeValue = sanitizeRichNoteHtml(value);
    if (editor.innerHTML !== safeValue) {
      editor.innerHTML = safeValue;
    }
  }, [value]);

  const emitValue = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(sanitizeRichNoteHtml(editor.innerHTML));
  };

  const applyFormat = (action: EditorAction) => {
    if (disabled) return;
    const editor = editorRef.current;
    if (!editor) return;
    if (applyRangeFormat(editor, action)) emitValue();
    editor.focus();
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white focus-within:border-teal-600 focus-within:ring-3 focus-within:ring-teal-700/15">
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
        {toolbarActions.map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormat(action)}
            disabled={disabled}
            aria-label={label}
            title={label}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-teal-800 hover:bg-teal-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
        <span className="ml-auto text-xs font-medium text-slate-700 pr-1">
          Formatação rápida
        </span>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        onInput={emitValue}
        onPaste={() => window.setTimeout(emitValue, 0)}
        className="rich-note-editor min-h-32 p-4 text-sm sm:text-base text-slate-800 leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
      />
    </div>
  );
};
