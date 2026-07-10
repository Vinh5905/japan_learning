import type { ExampleToken } from "@/lib/types";

type ExampleTextProps = {
  tokens: ExampleToken[];
  vietnamese: string;
};

export function ExampleText({ tokens, vietnamese }: ExampleTextProps) {
  return (
    <div className="example-lines">
      <div>{tokens.map((token, index) => renderRubyToken(token, index))}</div>
      <div className="example-vietnamese">{vietnamese}</div>
    </div>
  );
}

function renderRubyToken(token: ExampleToken, index: number) {
  const className = token.is_target ? "target-ruby" : undefined;

  if (!token.reading) {
    return (
      <span className={className} key={`${token.text}-${index}`}>
        {token.text}
      </span>
    );
  }

  return (
    <ruby className={className} key={`${token.text}-${index}`}>
      {token.text}
      <rt>{token.reading}</rt>
    </ruby>
  );
}
