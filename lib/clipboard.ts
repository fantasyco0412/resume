/**
 * Copy text to the clipboard.
 * `navigator.clipboard` needs a secure context (HTTPS / localhost) and often
 * fails on http://IP VPS deploys — fall back to a hidden textarea + execCommand.
 */
export async function writeClipboardText(text: string): Promise<void> {
  const value = String(text ?? "");
  if (!value) {
    throw new Error("Nothing to copy");
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through — common on non-HTTPS origins
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
  }

  if (!ok) {
    throw new Error("Couldn't copy to clipboard");
  }
}
