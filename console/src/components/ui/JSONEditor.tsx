import React from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/themes/prism-tomorrow.css";
import { cn } from "@/lib/utils";

interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export const JSONEditor: React.FC<JSONEditorProps> = ({
  value,
  onChange,
  className,
  placeholder,
}) => {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-secondary/50 text-xs transition-all duration-150 overflow-hidden focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
        className,
      )}
    >
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.json, "json")}
        padding={12}
        placeholder={placeholder}
        className="font-mono focus:outline-none min-h-[100px] leading-relaxed"
        textareaClassName="focus:outline-none !bg-transparent"
        preClassName="prism-code"
      />
    </div>
  );
};
