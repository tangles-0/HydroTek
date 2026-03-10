import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface SelectFieldProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export const SelectField = ({ options, value, onChange }: SelectFieldProps) => {
  return (
    <Select defaultValue={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
