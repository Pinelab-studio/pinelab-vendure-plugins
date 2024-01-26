export const sliceArray = (arr: number[], chunkSize: number): number[][] => {
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    if (i + chunkSize < arr.length) {
      result.push(arr.slice(i, i + chunkSize));
    } else {
      result.push(arr.slice(i));
    }
  }
  return result;
};
