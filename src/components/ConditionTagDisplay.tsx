import React from 'react';

interface ConditionTagDisplayProps {
  conditions: string[];
}

const ConditionTagDisplay: React.FC<ConditionTagDisplayProps> = ({ conditions }) => {
  if (!conditions || conditions.length === 0) {
    return null; // Or render some placeholder text if preferred
  }

  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map((condition, index) => (
        <span
          key={index}
          className="bg-mintGreen text-gray-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm"
        >
          {condition}
        </span>
      ))}
    </div>
  );
};

export default ConditionTagDisplay;

/*
// Example Usage:
// Make sure to import the component:
// import ConditionTagDisplay from '@/components/ConditionTagDisplay';

// --- In your component's render method ---
// const userConditions = ["Lupus", "Raynaud's Phenomenon", "Sjögren's Syndrome"];
// return (
//   <div>
//     <h3 className="text-lg font-semibold mb-2">Conditions:</h3>
//     <ConditionTagDisplay conditions={userConditions} />
//   </div>
// );

// --- Example with many conditions to show wrapping ---
// const manyConditions = Array.from({ length: 15 }, (_, i) => `Condition ${i + 1}`);
// return (
//   <div>
//     <h3 className="text-lg font-semibold mb-2">Many Conditions:</h3>
//     <ConditionTagDisplay conditions={manyConditions} />
//   </div>
// );
*/
