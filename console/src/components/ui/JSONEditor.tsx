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
        "relative rounded-xl border border-border/40 bg-muted/5 p-1 text-[12px] focus-within:ring-[3px] focus-within:ring-primary/30 focus-within:border-primary/60 transition-all overflow-hidden",
        className,
      )}
    >
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.json, "json")}
        padding={12}
        placeholder={placeholder}
        className="font-mono focus:outline-none min-h-[100px]"
        textareaClassName="focus:outline-none"
        preClassName="prism-code"
      />
    </div>
  );
};
