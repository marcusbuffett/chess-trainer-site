import { chunk, flatMap } from "lodash";

export const intersperse = <T,>(arr: T[], separator: (n: number) => T): T[] => {
  let segments = chunk(arr, 2);
  // segments = _.map(segments, (arr) => {
  //   })
  return arr.reduce<T[]>((acc, currentElement, currentIndex) => {
    const isLast = currentIndex === arr.length - 1;
    return [
      ...acc,
      currentElement,
      ...(isLast ? [] : [separator(currentIndex)]),
    ];
  }, []);
};

export const chunked = <T,>(
  arr: T[],
  separator: (n: number) => T,
  chunking?: number,
  chunkSeperator?: (n: number) => T,
  chunkContainer?: (n: T) => T
): T[] => {
  let segments = chunk(arr, chunking);
  // @ts-ignore
  segments = intersperse(segments, (i) => chunkSeperator(i));
  // @ts-ignore
  segments = flatMap(segments, (segment) => {
    if (Array.isArray(segment)) {
      // @ts-ignore
      return chunkContainer(intersperse(segment, separator));
    }
    return segment;
  });
  // @ts-ignore
  return segments;
};
