export function DataTable({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">{children}</table>
      </div>
      {footer}
    </div>
  );
}

export function TableEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{children}</p>;
}
