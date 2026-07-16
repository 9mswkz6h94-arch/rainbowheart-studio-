
import React from 'react';

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  value,
  onChange,
  options,
  className = ''
}) => {
  const id = `select-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
