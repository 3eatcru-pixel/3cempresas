import React from 'react';

interface StoreShowcaseCategoryBarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  isLightMode: boolean;
}

export const StoreShowcaseCategoryBar: React.FC<StoreShowcaseCategoryBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  isLightMode,
}) => {
  if (categories.length <= 2) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelectCategory(cat)}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase transition-all shrink-0 cursor-pointer ${
            selectedCategory === cat
              ? isLightMode
                ? 'bg-stone-900 text-white'
                : 'bg-slate-800 text-white'
              : isLightMode
              ? 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};
