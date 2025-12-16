import React from 'react';
import { Laptop, Shirt, Plane, Pizza, Briefcase } from 'lucide-react';

export const categories = [
    { id: 'tech', label: 'TECH', icon: Laptop },
    { id: 'fashion', label: 'FASHION', icon: Shirt },
    { id: 'travel', label: 'TRAVEL', icon: Plane },
    { id: 'food', label: 'FOOD', icon: Pizza },
    { id: 'services', label: 'SERVICES', icon: Briefcase }
];

interface CategoryChipsProps {
    onSelect: (category: string) => void;
}

const CategoryChips: React.FC<CategoryChipsProps> = ({ onSelect }) => {
    return (
        <div className="flex flex-wrap justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
            {categories.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => onSelect(cat.label)}
                    className="relative flex items-center gap-2 px-4 py-2 rounded-sm bg-black/50 border border-hunter-border hover:border-hunter-cyan hover:bg-hunter-cyan/20 transition-all text-[10px] font-display tracking-wider text-hunter-muted hover:text-white active:scale-95 active:border-hunter-green active:bg-hunter-green/30 hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] active:shadow-[0_0_30px_rgba(10,255,0,0.7)] group"
                >
                    <div className="absolute inset-0 bg-hunter-cyan/0 group-hover:bg-hunter-cyan/10 group-active:bg-hunter-green/20 blur-sm transition-all duration-300"></div>
                    <cat.icon size={12} className="relative z-10 group-hover:text-hunter-cyan group-active:text-hunter-green transition-colors" />
                    <span className="relative z-10">{cat.label}</span>
                </button>
            ))}
        </div>
    );
};

export default CategoryChips;
