import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExampleText } from "@/components/ExampleText";

describe("ExampleText", () => {
  it("renders ruby furigana and target styling", () => {
    const { container } = render(
      <ExampleText
        tokens={[
          { text: "井戸", reading: "いど", is_target: true },
          { text: "水", reading: "みず" },
          { text: "を" },
          { text: "飲", reading: "の" },
          { text: "んだ" },
        ]}
        vietnamese="Tôi đã uống nước giếng"
      />,
    );

    expect(screen.getByText("Tôi đã uống nước giếng")).toBeInTheDocument();
    expect(container.querySelector("ruby rt")?.textContent).toBe("いど");
    expect(container.querySelector(".target-ruby")?.textContent).toContain("井戸");
  });
});
