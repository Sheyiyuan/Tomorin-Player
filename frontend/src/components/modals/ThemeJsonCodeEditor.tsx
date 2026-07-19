import CodeEditor from "@uiw/react-textarea-code-editor";

interface ThemeJsonCodeEditorProps {
    value: string;
    colorMode: "light" | "dark";
    disabled: boolean;
    backgroundColor?: string;
    textColor?: string;
    onChange: (value: string) => void;
}

const ThemeJsonCodeEditor = ({
    value,
    colorMode,
    disabled,
    backgroundColor,
    textColor,
    onChange,
}: ThemeJsonCodeEditorProps) => (
    <CodeEditor
        value={value}
        language="json"
        placeholder="粘贴或编辑 JSON 配置..."
        onChange={(event) => onChange(event.target.value)}
        style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "14px",
            lineHeight: "1.5",
            backgroundColor,
            color: textColor,
            border: "none",
        }}
        data-color-mode={colorMode}
        disabled={disabled}
        minHeight={260}
    />
);

export default ThemeJsonCodeEditor;
