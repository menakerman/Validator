interface StatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

const colorClasses = {
  blue: 'bg-primary-50 border-primary-200 text-primary-700',
  green: 'bg-valid-50 border-valid-200 text-valid-700',
  yellow: 'bg-warning-50 border-warning-200 text-warning-700',
  red: 'bg-error-50 border-error-200 text-error-700',
};

export function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
