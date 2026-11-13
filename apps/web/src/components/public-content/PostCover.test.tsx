import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { PostCover } from "./PostCover";

it("reserves source dimensions and provides informative alternative text", () => {
  render(
    <PostCover
      title="Story"
      cover={{
        url: "/media/public",
        alt: "A landscape",
        width: 800,
        height: 600,
      }}
      card
    />,
  );
  const image = screen.getByRole("img", { name: "A landscape" });
  expect(image).toHaveAttribute("width", "800");
  expect(image).toHaveAttribute("height", "600");
  expect(image).toHaveAttribute("src", "/media/public");
  expect(image).not.toHaveAttribute("srcset");
});
it.each([
  undefined,
  null,
  { url: "/media/public", alt: "", width: null, height: 600 },
])("omits unsafe-to-size covers %j", (cover) => {
  render(<PostCover title="Story" cover={cover} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
