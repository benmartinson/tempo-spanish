import { findClosestWord } from "./helpers";

describe("findClosestWord", () => {
  it("returns the exact match when spoken word matches a word in the list", () => {
    const words = [
      { word: "Cuando" },
      { word: "reaparecio" },
      { word: "necesario" },
      { word: "necesario" },
    ];

    const result = findClosestWord("ceseri", words);

    expect(result).toEqual({ word: "necesario" });
  });
});
