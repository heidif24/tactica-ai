/** Format client briefs for download (txt + print-ready HTML) */

export function briefToHtml(title: string, plain: string): string {
  const escaped = plain
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
  const body = escaped
    .split("\n")
    .map((line) => {
      if (/^[A-Z0-9 .—–-]+$/.test(line) && line.length > 3 && line === line.toUpperCase()) {
        return `<h2 style="margin:1.4em 0 0.5em;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#0c8ce9;">${line}</h2>`;
      }
      if (line.startsWith("•") || line.startsWith("-")) {
        return `<li style="margin:0.25em 0;color:#3a3a41;">${line.replace(/^[•\-]\s*/, "")}</li>`;
      }
      if (!line.trim()) return "";
      return `<p style="margin:0.4em 0;line-height:1.55;color:#3a3a41;">${line}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${title.replace(/</g, "")}</title>
<style>
  body { font-family: "Segoe UI", system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px 64px; color: #18181b; background: #fafafa; }
  .card { background: #fff; border: 1px solid #eeeef0; border-radius: 16px; padding: 32px 36px; box-shadow: 0 12px 40px -12px rgba(15,23,42,0.12); }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .mark { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg,#36a7f8,#0c8ce9); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #9191a0; margin-bottom: 24px; }
  ul { padding-left: 1.2em; margin: 0.5em 0; }
  @media print { body { background: #fff; margin: 0; } .card { box-shadow: none; border: none; } }
</style>
</head>
<body>
  <div class="card">
    <div class="brand"><div class="mark">✦</div><div><h1>Lumen analytical brief</h1><div class="meta">${title.replace(/</g, "")}</div></div></div>
    ${body}
  </div>
</body>
</html>`;
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadHtml(filename: string, title: string, plain: string) {
  const html = briefToHtml(title, plain);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
