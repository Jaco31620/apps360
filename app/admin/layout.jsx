/* Backoffice apps360 (/admin) : page privée, non indexée. */
export const metadata = { title: "Backoffice — apps360", robots: { index: false, follow: false } };

export default function AdminLayout({ children }) {
  return children;
}
